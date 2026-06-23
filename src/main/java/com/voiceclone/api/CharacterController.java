package com.voiceclone.api;

import com.voiceclone.service.CharacterService;
import com.voiceclone.service.CharacterService.VoiceCharacter;
import com.voiceclone.service.SynthesisJobService;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/characters")
public class CharacterController {
    private final CharacterService characterService;
    private final SynthesisJobService jobService;

    public CharacterController(CharacterService characterService, SynthesisJobService jobService) {
        this.characterService = characterService;
        this.jobService = jobService;
    }

    @GetMapping
    public List<VoiceCharacter> listCharacters() {
        return characterService.listCharacters();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public VoiceCharacter createCharacter(
            @RequestParam("name") @NotBlank String name,
            @RequestParam(value = "description", required = false, defaultValue = "") String description,
            @RequestParam("sampleFile") MultipartFile sampleFile,
            @RequestParam(value = "durationSeconds", required = false) Double durationSeconds) {
        return characterService.create(name, description, sampleFile, durationSeconds);
    }

    @GetMapping("/{id}")
    public VoiceCharacter getCharacter(@PathVariable String id) {
        return characterService.getCharacter(id);
    }

    @GetMapping("/{id}/audio")
    public ResponseEntity<byte[]> getCharacterAudio(@PathVariable String id) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/wav"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename("character-sample.wav").build().toString())
                .body(characterService.getAudio(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCharacter(@PathVariable String id) {
        if (jobService.isCharacterReferenced(id)) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "该角色已被历史记录使用，不能删除。");
        }
        characterService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
