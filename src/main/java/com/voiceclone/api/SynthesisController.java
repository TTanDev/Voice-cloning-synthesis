package com.voiceclone.api;

import com.voiceclone.service.MimoVoiceCloneService;
import com.voiceclone.service.MimoVoiceCloneService.SynthesisResult;
import com.voiceclone.service.SynthesisJobService;
import com.voiceclone.service.SynthesisJobService.SynthesisJob;
import com.voiceclone.service.SynthesisJobService.SynthesisJobSummary;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class SynthesisController {
    private final MimoVoiceCloneService voiceCloneService;
    private final SynthesisJobService jobService;

    public SynthesisController(MimoVoiceCloneService voiceCloneService, SynthesisJobService jobService) {
        this.voiceCloneService = voiceCloneService;
        this.jobService = jobService;
    }

    @PostMapping(value = "/synthesize", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> synthesize(
            @RequestParam("voiceFile") MultipartFile voiceFile,
            @RequestParam("text") @NotBlank String text,
            @RequestParam(value = "stylePrompt", required = false, defaultValue = "") String stylePrompt) {
        SynthesisResult result = voiceCloneService.synthesize(voiceFile, text, stylePrompt);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/wav"))
                .header("X-Mimo-Elapsed-Ms", String.valueOf(result.mimoElapsedMillis()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("mimo-voiceclone.wav").build().toString())
                .body(result.audioBytes());
    }

    @PostMapping(value = "/synthesize/jobs", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SynthesisJobSummary submitJob(
            @RequestParam(value = "characterId", required = false, defaultValue = "") String characterId,
            @RequestParam("text") @NotBlank String text,
            @RequestParam(value = "stylePrompt", required = false, defaultValue = "") String stylePrompt) {
        if (characterId == null || characterId.isBlank()) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "请先选择角色。");
        }
        SynthesisJob job = jobService.submitWithCharacter(characterId, text, stylePrompt);
        return SynthesisJobSummary.from(job);
    }

    @PostMapping(value = "/synthesize/jobs", consumes = MediaType.APPLICATION_JSON_VALUE)
    public SynthesisJobSummary submitCharacterJob(@RequestBody CharacterJobRequest request) {
        SynthesisJob job = jobService.submitWithCharacter(
                request.characterId(),
                request.text(),
                request.stylePrompt() == null ? "" : request.stylePrompt());
        return SynthesisJobSummary.from(job);
    }

    @GetMapping("/synthesize/jobs")
    public List<SynthesisJobSummary> listJobs() {
        return jobService.listJobs();
    }

    @GetMapping("/synthesize/groups")
    public List<String> listGroups() {
        return jobService.listGroups();
    }

    @GetMapping("/synthesize/jobs/{id}")
    public SynthesisJobSummary getJob(@PathVariable String id) {
        return SynthesisJobSummary.from(jobService.getJob(id));
    }

    @GetMapping("/synthesize/jobs/{id}/audio")
    public ResponseEntity<byte[]> getJobAudio(@PathVariable String id) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/wav"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("mimo-voiceclone.wav").build().toString())
                .body(jobService.getAudio(id));
    }

    @DeleteMapping("/synthesize/jobs/{id}")
    public ResponseEntity<Void> deleteJob(@PathVariable String id) {
        jobService.deleteJob(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/synthesize/jobs/batch")
    public java.util.Map<String, Object> deleteJobs(@RequestBody List<String> ids) {
        int deleted = jobService.deleteJobs(ids);
        return java.util.Map.of("deleted", deleted);
    }

    @PatchMapping("/synthesize/jobs/{id}/archive")
    public SynthesisJobSummary updateArchive(
            @PathVariable String id,
            @RequestBody ArchiveRequest request) {
        return SynthesisJobSummary.from(jobService.updateArchive(id, request.archived(), request.groupName()));
    }

    @PatchMapping("/synthesize/jobs/{id}/read")
    public SynthesisJobSummary updateRead(
            @PathVariable String id,
            @RequestBody ReadRequest request) {
        return SynthesisJobSummary.from(jobService.updateRead(id, request.read()));
    }

    public record ArchiveRequest(boolean archived, String groupName) {
    }

    public record ReadRequest(boolean read) {
    }

    public record CharacterJobRequest(@NotBlank String characterId, @NotBlank String text, String stylePrompt) {
    }
}
