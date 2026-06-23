package com.voiceclone.service;

import com.voiceclone.api.ApiException;
import com.voiceclone.service.MimoVoiceCloneService.SynthesisResult;
import com.voiceclone.service.CharacterService.VoiceCharacter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class SynthesisJobService {
    private static final String CHARACTER_SAMPLE_FILENAME = "character-sample.wav";

    private static final Logger log = LoggerFactory.getLogger(SynthesisJobService.class);

    private final MimoVoiceCloneService voiceCloneService;
    private final CharacterService characterService;
    private final ObjectMapper objectMapper;
    private final Path historyDir;
    private final Path voiceQueueDir;
    private final ExecutorService executorService;
    private final ConcurrentHashMap<String, SynthesisJob> jobs = new ConcurrentHashMap<>();

    public SynthesisJobService(
            MimoVoiceCloneService voiceCloneService,
            CharacterService characterService,
            ObjectMapper objectMapper) {
        this.voiceCloneService = voiceCloneService;
        this.characterService = characterService;
        this.objectMapper = objectMapper;
        Path baseDir = Path.of(System.getProperty("user.dir"), ".mimo-voiceclone");
        this.historyDir = baseDir.resolve("history");
        this.voiceQueueDir = baseDir.resolve("voice-queue");
        this.executorService = Executors.newSingleThreadExecutor();
        migrateFromOldLocation();
        loadPersistedJobs();
    }

    private void migrateFromOldLocation() {
        Path oldBase = Path.of(System.getProperty("user.home"), ".mimo-voiceclone");
        if (!Files.exists(oldBase) || oldBase.equals(historyDir.getParent())) {
            return;
        }
        Path oldHistory = oldBase.resolve("history");
        if (Files.exists(oldHistory) && !Files.exists(historyDir)) {
            try {
                Files.createDirectories(historyDir.getParent());
                Files.move(oldHistory, historyDir);
                log.info("Migrated history directory from {} to {}", oldHistory, historyDir);
            } catch (IOException exception) {
                log.warn("Failed to migrate history directory: {}", exception.getMessage());
            }
        }
        Path oldVoiceQueue = Path.of(System.getProperty("user.dir"), "voice-queue");
        if (Files.exists(oldVoiceQueue) && !oldVoiceQueue.equals(voiceQueueDir)) {
            try {
                if (!Files.exists(voiceQueueDir)) {
                    Files.move(oldVoiceQueue, voiceQueueDir);
                    log.info("Migrated voice-queue directory from {} to {}", oldVoiceQueue, voiceQueueDir);
                }
            } catch (IOException exception) {
                log.warn("Failed to migrate voice-queue directory: {}", exception.getMessage());
            }
        }
    }

    public SynthesisJob submitWithCharacter(String characterId, String text, String stylePrompt) {
        VoiceCharacter character = characterService.getCharacter(characterId);
        return submitInternal(
                characterService.getAudio(character.id()),
                "audio/wav",
                text,
                stylePrompt,
                character.id(),
                character.name());
    }

    private SynthesisJob submitInternal(
            byte[] voiceBytes,
            String contentType,
            String text,
            String stylePrompt,
            String characterId,
            String characterName) {
        String id = UUID.randomUUID().toString();
        SynthesisJob job = new SynthesisJob(id, text, stylePrompt, contentType, characterId, characterName);
        jobs.put(id, job);
        Path voicePath = voiceInputPath(id);
        try {
            Files.createDirectories(voiceQueueDir);
            Files.write(voicePath, voiceBytes);
        } catch (IOException exception) {
            log.warn("Failed to persist voice sample for job {}", id, exception);
        }
        executorService.submit(() -> runJob(job, voicePath));
        return job;
    }

    public List<SynthesisJobSummary> listJobs() {
        return jobs.values().stream()
                .sorted(Comparator.comparing(SynthesisJob::createdAt).reversed())
                .map(SynthesisJobSummary::from)
                .toList();
    }

    public List<String> listGroups() {
        return jobs.values().stream()
                .map(SynthesisJob::groupName)
                .filter(groupName -> groupName != null && !groupName.isBlank())
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }

    public boolean isCharacterReferenced(String characterId) {
        return jobs.values().stream()
                .anyMatch(job -> characterId != null && characterId.equals(job.characterId()));
    }

    public SynthesisJob getJob(String id) {
        SynthesisJob job = jobs.get(id);
        if (job == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "未找到该合成任务。");
        }
        return job;
    }

    public byte[] getAudio(String id) {
        SynthesisJob job = getJob(id);
        if (job.status() != SynthesisStatus.SUCCEEDED || job.audioBytes() == null) {
            byte[] audioBytes = readPersistedAudio(job);
            if (audioBytes != null) {
                return audioBytes;
            }
            throw new ApiException(HttpStatus.BAD_REQUEST, "该任务还没有可下载音频。");
        }
        return job.audioBytes();
    }

    public void deleteJob(String id) {
        SynthesisJob job = jobs.remove(id);
        if (job == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "未找到该合成任务。");
        }
        deleteQuietly(metadataPath(id));
        deleteQuietly(audioPath(id));
        deleteQuietly(voiceInputPath(id));
        log.info("Deleted synthesis job {}", id);
    }

    public int deleteJobs(List<String> ids) {
        int deleted = 0;
        for (String id : ids) {
            SynthesisJob job = jobs.remove(id);
            if (job != null) {
                deleteQuietly(metadataPath(id));
                deleteQuietly(audioPath(id));
                deleteQuietly(voiceInputPath(id));
                deleted++;
            }
        }
        log.info("Batch deleted {} of {} synthesis jobs", deleted, ids.size());
        return deleted;
    }

    public SynthesisJob updateArchive(String id, boolean archived, String groupName) {
        SynthesisJob job = getJob(id);
        job.setArchiveState(archived, groupName);
        persistJob(job);
        return job;
    }

    public SynthesisJob updateRead(String id, boolean read) {
        SynthesisJob job = getJob(id);
        job.setRead(read);
        persistJob(job);
        return job;
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            log.warn("Failed to delete {}", path, exception);
        }
    }

    private void runJob(SynthesisJob job, Path voicePath) {
        job.markRunning();
        try {
            byte[] voiceBytes = Files.readAllBytes(voicePath);
            SynthesisResult result = voiceCloneService.synthesize(
                    voiceBytes,
                    CHARACTER_SAMPLE_FILENAME,
                    job.contentType(),
                    job.text(),
                    job.stylePrompt());
            job.markSucceeded(result.audioBytes(), result.mimoElapsedMillis());
            persistJob(job);
        } catch (Exception exception) {
            job.markFailed(exception.getMessage());
            persistJob(job);
        } finally {
            deleteQuietly(voicePath);
        }
    }

    private void loadPersistedJobs() {
        if (!Files.exists(historyDir)) {
            return;
        }
        try (var stream = Files.list(historyDir)) {
            stream.filter(path -> path.getFileName().toString().endsWith(".json"))
                    .forEach(this::loadPersistedJob);
        } catch (IOException exception) {
            log.warn("Failed to load synthesis history from {}", historyDir, exception);
        }
        // Clean up orphaned voice input files (no matching job in memory)
        if (Files.exists(voiceQueueDir)) {
            try (var stream = Files.list(voiceQueueDir)) {
                stream.filter(path -> path.getFileName().toString().endsWith("-input.bin"))
                        .forEach(path -> {
                            String id = path.getFileName().toString().replace("-input.bin", "");
                            if (!jobs.containsKey(id)) {
                                deleteQuietly(path);
                                log.info("Cleaned up orphaned voice input file {}", path.getFileName());
                            }
                        });
            } catch (IOException exception) {
                log.warn("Failed to clean up orphaned voice input files", exception);
            }
        }
    }

    private void loadPersistedJob(Path metadataFile) {
        try {
            PersistedJob persisted = objectMapper.readValue(metadataFile.toFile(), PersistedJob.class);
            SynthesisJob job = SynthesisJob.fromPersisted(persisted);
            byte[] audioBytes = readPersistedAudio(job);
            if (audioBytes != null) {
                job.setAudioBytes(audioBytes);
            }
            jobs.put(job.id(), job);
        } catch (Exception exception) {
            log.warn("Failed to load persisted synthesis job {}", metadataFile, exception);
        }
    }

    private void persistJob(SynthesisJob job) {
        try {
            Files.createDirectories(historyDir);
            PersistedJob persisted = PersistedJob.from(job);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(metadataPath(job.id()).toFile(), persisted);
            if (job.status() == SynthesisStatus.SUCCEEDED && job.audioBytes() != null) {
                Files.write(audioPath(job.id()), job.audioBytes());
            }
        } catch (IOException exception) {
            log.warn("Failed to persist synthesis job {}", job.id(), exception);
        }
    }

    private byte[] readPersistedAudio(SynthesisJob job) {
        Path path = audioPath(job.id());
        if (!Files.exists(path)) {
            return null;
        }
        try {
            return Files.readAllBytes(path);
        } catch (IOException exception) {
            log.warn("Failed to read persisted audio {}", path, exception);
            return null;
        }
    }

    private Path metadataPath(String id) {
        return historyDir.resolve(id + ".json");
    }

    private Path audioPath(String id) {
        return historyDir.resolve(id + ".wav");
    }

    private Path voiceInputPath(String id) {
        return voiceQueueDir.resolve(id + "-input.bin");
    }

    public enum SynthesisStatus {
        QUEUED,
        RUNNING,
        SUCCEEDED,
        FAILED
    }

    public static class SynthesisJob {
        private final String id;
        private final String text;
        private final String stylePrompt;
        private final String contentType;
        private final Instant createdAt;
        private volatile Instant startedAt;
        private volatile Instant finishedAt;
        private volatile SynthesisStatus status;
        private volatile String error;
        private volatile byte[] audioBytes;
        private volatile long mimoElapsedMillis;
        private volatile boolean archived;
        private volatile String groupName;
        private volatile boolean read;
        private volatile String characterId;
        private volatile String characterName;

        public SynthesisJob(String id, String text, String stylePrompt, String contentType) {
            this(id, text, stylePrompt, contentType, "", "");
        }

        public SynthesisJob(
                String id,
                String text,
                String stylePrompt,
                String contentType,
                String characterId,
                String characterName) {
            this(id, text, stylePrompt, contentType, characterId, characterName, Instant.now());
        }

        private SynthesisJob(
                String id,
                String text,
                String stylePrompt,
                String contentType,
                String characterId,
                String characterName,
                Instant createdAt) {
            this.id = id;
            this.text = text;
            this.stylePrompt = stylePrompt;
            this.contentType = contentType;
            this.characterId = characterId == null ? "" : characterId;
            this.characterName = characterName == null ? "" : characterName;
            this.createdAt = createdAt;
            this.status = SynthesisStatus.QUEUED;
        }

        public void markRunning() {
            this.status = SynthesisStatus.RUNNING;
            this.startedAt = Instant.now();
        }

        public void markSucceeded(byte[] audioBytes, long mimoElapsedMillis) {
            this.status = SynthesisStatus.SUCCEEDED;
            this.audioBytes = audioBytes;
            this.mimoElapsedMillis = mimoElapsedMillis;
            this.finishedAt = Instant.now();
        }

        public void markFailed(String error) {
            this.status = SynthesisStatus.FAILED;
            this.error = error;
            this.finishedAt = Instant.now();
        }

        public void setAudioBytes(byte[] audioBytes) {
            this.audioBytes = audioBytes;
        }

        public void setArchiveState(boolean archived, String groupName) {
            this.archived = archived;
            String normalizedGroup = groupName == null ? "" : groupName.trim();
            this.groupName = normalizedGroup;
        }

        public void setRead(boolean read) {
            this.read = read;
        }

        public static SynthesisJob fromPersisted(PersistedJob persisted) {
            SynthesisJob job = new SynthesisJob(
                    persisted.id(),
                    persisted.text(),
                    persisted.stylePrompt(),
                    persisted.contentType(),
                    persisted.characterId(),
                    persisted.characterName(),
                    persisted.createdAt());
            job.status = persisted.status();
            job.error = persisted.error();
            job.startedAt = persisted.startedAt();
            job.finishedAt = persisted.finishedAt();
            job.mimoElapsedMillis = persisted.mimoElapsedMillis();
            job.archived = persisted.archived();
            job.groupName = persisted.groupName();
            job.read = persisted.read();
            return job;
        }

        public String id() {
            return id;
        }

        public String text() {
            return text;
        }

        public String stylePrompt() {
            return stylePrompt;
        }

        public String contentType() {
            return contentType;
        }

        public Instant createdAt() {
            return createdAt;
        }

        public Instant startedAt() {
            return startedAt;
        }

        public Instant finishedAt() {
            return finishedAt;
        }

        public SynthesisStatus status() {
            return status;
        }

        public String error() {
            return error;
        }

        public byte[] audioBytes() {
            return audioBytes;
        }

        public long mimoElapsedMillis() {
            return mimoElapsedMillis;
        }

        public boolean archived() {
            return archived;
        }

        public String groupName() {
            return groupName;
        }

        public boolean read() {
            return read;
        }

        public String characterId() {
            return characterId;
        }

        public String characterName() {
            return characterName;
        }
    }

    public record SynthesisJobSummary(
            String id,
            String text,
            String stylePrompt,
            Instant createdAt,
            Instant startedAt,
            Instant finishedAt,
            SynthesisStatus status,
            String error,
            long mimoElapsedMillis,
            boolean archived,
            String groupName,
            boolean read,
            String characterId,
            String characterName) {
        public static SynthesisJobSummary from(SynthesisJob job) {
            return new SynthesisJobSummary(
                    job.id(),
                    job.text(),
                    job.stylePrompt(),
                    job.createdAt(),
                    job.startedAt(),
                    job.finishedAt(),
                    job.status(),
                    job.error(),
                    job.mimoElapsedMillis(),
                    job.archived(),
                    job.groupName(),
                    job.read(),
                    job.characterId(),
                    job.characterName());
        }
    }

    public record PersistedJob(
            String id,
            String text,
            String stylePrompt,
            String contentType,
            Instant createdAt,
            Instant startedAt,
            Instant finishedAt,
            SynthesisStatus status,
            String error,
            long mimoElapsedMillis,
            boolean archived,
            String groupName,
            boolean read,
            String characterId,
            String characterName) {
        public static PersistedJob from(SynthesisJob job) {
            return new PersistedJob(
                    job.id(),
                    job.text(),
                    job.stylePrompt(),
                    job.contentType(),
                    job.createdAt(),
                    job.startedAt(),
                    job.finishedAt(),
                    job.status(),
                    job.error(),
                    job.mimoElapsedMillis(),
                    job.archived(),
                    job.groupName(),
                    job.read(),
                    job.characterId(),
                    job.characterName());
        }
    }
}
