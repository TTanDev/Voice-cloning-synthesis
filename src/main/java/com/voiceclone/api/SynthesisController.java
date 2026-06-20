package com.voiceclone.api;

import com.voiceclone.service.MimoVoiceCloneService;
import com.voiceclone.service.MimoVoiceCloneService.SynthesisResult;
import com.voiceclone.service.SynthesisJobService;
import com.voiceclone.service.SynthesisJobService.SynthesisJob;
import com.voiceclone.service.SynthesisJobService.SynthesisJobSummary;
import jakarta.validation.constraints.NotBlank;
import java.io.IOException;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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
            @RequestParam("voiceFile") MultipartFile voiceFile,
            @RequestParam("text") @NotBlank String text,
            @RequestParam(value = "stylePrompt", required = false, defaultValue = "") String stylePrompt)
            throws IOException {
        SynthesisJob job = jobService.submit(
                voiceFile.getBytes(),
                voiceFile.getOriginalFilename(),
                voiceFile.getContentType(),
                text,
                stylePrompt);
        return SynthesisJobSummary.from(job);
    }

    @GetMapping("/synthesize/jobs")
    public List<SynthesisJobSummary> listJobs() {
        return jobService.listJobs();
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
}
