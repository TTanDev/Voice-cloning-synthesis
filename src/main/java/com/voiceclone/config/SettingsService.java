package com.voiceclone.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class SettingsService {
    private static final Logger log = LoggerFactory.getLogger(SettingsService.class);

    private final ObjectMapper objectMapper;
    private final Path settingsFile;
    private volatile MimoSettings settings;

    public SettingsService(
            ObjectMapper objectMapper,
            @Value("${MIMO_API_KEY:}") String envApiKey,
            @Value("${mimo.base-url:https://api.xiaomimimo.com/v1}") String defaultBaseUrl) {
        this.objectMapper = objectMapper;
        Path baseDir = Path.of(System.getProperty("user.dir"), ".mimo-voiceclone");
        this.settingsFile = baseDir.resolve("settings.json");
        migrateOldSettings();
        this.settings = loadSettings(envApiKey, defaultBaseUrl);
    }

    private void migrateOldSettings() {
        Path oldSettingsFile = Path.of(System.getProperty("user.home"), ".mimo-voiceclone", "settings.json");
        if (Files.exists(oldSettingsFile) && !Files.exists(settingsFile)) {
            try {
                Files.createDirectories(settingsFile.getParent());
                Files.copy(oldSettingsFile, settingsFile, StandardCopyOption.REPLACE_EXISTING);
                log.info("Migrated settings from {} to {}", oldSettingsFile, settingsFile);
            } catch (IOException exception) {
                log.warn("Failed to migrate settings file: {}", exception.getMessage());
            }
        }
    }

    public MimoSettings getPublicSettings() {
        return new MimoSettings(mask(settings.getApiKey()), settings.getBaseUrl());
    }

    public MimoSettings getInternalSettings() {
        return settings;
    }

    public MimoSettings update(String apiKey, String baseUrl) {
        String nextApiKey = StringUtils.hasText(apiKey) ? apiKey.trim() : settings.getApiKey();
        String nextBaseUrl = StringUtils.hasText(baseUrl) ? trimTrailingSlash(baseUrl.trim()) : settings.getBaseUrl();
        settings = new MimoSettings(nextApiKey, nextBaseUrl);
        saveSettings(settings);
        return getPublicSettings();
    }

    private MimoSettings loadSettings(String envApiKey, String defaultBaseUrl) {
        MimoSettings loaded = readSettingsFile();
        String apiKey = StringUtils.hasText(envApiKey) ? envApiKey.trim() : loaded.getApiKey();
        String baseUrl = StringUtils.hasText(loaded.getBaseUrl()) ? loaded.getBaseUrl() : defaultBaseUrl;
        return new MimoSettings(apiKey, trimTrailingSlash(baseUrl));
    }

    private MimoSettings readSettingsFile() {
        if (!Files.exists(settingsFile)) {
            return new MimoSettings();
        }
        try {
            return objectMapper.readValue(settingsFile.toFile(), MimoSettings.class);
        } catch (IOException exception) {
            log.warn("Failed to read local settings from {}", settingsFile, exception);
            return new MimoSettings();
        }
    }

    private void saveSettings(MimoSettings settings) {
        try {
            Files.createDirectories(settingsFile.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(settingsFile.toFile(), settings);
        } catch (IOException exception) {
            log.warn("Failed to persist local settings to {}", settingsFile, exception);
        }
    }

    private String trimTrailingSlash(String value) {
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }

    private String mask(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        if (value.length() <= 8) {
            return "****";
        }
        return value.substring(0, 4) + "****" + value.substring(value.length() - 4);
    }
}
