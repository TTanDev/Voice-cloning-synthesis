package com.voiceclone.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.voiceclone.api.ApiException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class CharacterService {
    private static final long MAX_SAMPLE_BYTES = 8L * 1024L * 1024L;

    private final ObjectMapper objectMapper;
    private final Path charactersDir;

    public CharacterService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        Path baseDir = Path.of(System.getProperty("user.dir"), ".mimo-voiceclone");
        this.charactersDir = baseDir.resolve("characters");
    }

    public List<VoiceCharacter> listCharacters() {
        if (!Files.exists(charactersDir)) {
            return List.of();
        }
        try (var stream = Files.list(charactersDir)) {
            return stream
                    .filter(path -> path.getFileName().toString().endsWith(".json"))
                    .map(this::readCharacterQuietly)
                    .filter(character -> character != null)
                    .sorted(Comparator.comparing(VoiceCharacter::createdAt).reversed())
                    .toList();
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "读取角色列表失败。");
        }
    }

    public VoiceCharacter getCharacter(String id) {
        Path metadataPath = metadataPath(id);
        if (!Files.exists(metadataPath)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "未找到该角色。");
        }
        try {
            return objectMapper.readValue(metadataPath.toFile(), VoiceCharacter.class);
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "读取角色失败。");
        }
    }

    public byte[] getAudio(String id) {
        getCharacter(id);
        Path path = audioPath(id);
        if (!Files.exists(path)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "角色样本音频不存在。");
        }
        try {
            return Files.readAllBytes(path);
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "读取角色样本音频失败。");
        }
    }

    public VoiceCharacter create(String name, String description, MultipartFile sampleFile, Double durationSeconds) {
        if (!StringUtils.hasText(name)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请输入角色名。");
        }
        if (sampleFile == null || sampleFile.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请上传转换后的 WAV 样本。");
        }
        byte[] bytes;
        try {
            bytes = sampleFile.getBytes();
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "读取角色样本失败。");
        }
        validateWav(bytes);
        if (bytes.length > MAX_SAMPLE_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "角色样本过大，请换一段更短的样本。");
        }

        String id = UUID.randomUUID().toString();
        VoiceCharacter character = new VoiceCharacter(
                id,
                name.trim(),
                StringUtils.hasText(description) ? description.trim() : "",
                sampleFile.getOriginalFilename(),
                Instant.now(),
                bytes.length,
                durationSeconds != null && durationSeconds > 0 ? durationSeconds : 0);
        try {
            Files.createDirectories(charactersDir);
            Files.write(audioPath(id), bytes);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(metadataPath(id).toFile(), character);
            return character;
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "保存角色失败。");
        }
    }

    public void delete(String id) {
        getCharacter(id);
        try {
            Files.deleteIfExists(audioPath(id));
            Files.deleteIfExists(metadataPath(id));
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "删除角色失败。");
        }
    }

    private VoiceCharacter readCharacterQuietly(Path path) {
        try {
            return objectMapper.readValue(path.toFile(), VoiceCharacter.class);
        } catch (IOException exception) {
            return null;
        }
    }

    private void validateWav(byte[] bytes) {
        if (bytes == null || bytes.length <= 44) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "转换后的 WAV 样本无效。");
        }
        String riff = new String(bytes, 0, 4, StandardCharsets.US_ASCII);
        String wave = new String(bytes, 8, 4, StandardCharsets.US_ASCII);
        if (!"RIFF".equals(riff) || !"WAVE".equals(wave)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请上传转换后的 WAV 样本。");
        }
    }

    private Path metadataPath(String id) {
        return charactersDir.resolve(id + ".json");
    }

    private Path audioPath(String id) {
        return charactersDir.resolve(id + ".wav");
    }

    public record VoiceCharacter(
            String id,
            String name,
            String description,
            String originalFilename,
            Instant createdAt,
            long sampleSizeBytes,
            double sampleDurationSeconds) {
    }
}
