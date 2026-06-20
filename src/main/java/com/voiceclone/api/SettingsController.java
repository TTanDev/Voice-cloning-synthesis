package com.voiceclone.api;

import com.voiceclone.config.MimoSettings;
import com.voiceclone.config.SettingsService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {
    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public MimoSettings getSettings() {
        return settingsService.getPublicSettings();
    }

    @PostMapping
    public MimoSettings updateSettings(@RequestBody SettingsRequest request) {
        return settingsService.update(request.apiKey(), request.baseUrl());
    }

    public record SettingsRequest(String apiKey, @NotBlank String baseUrl) {
    }
}
