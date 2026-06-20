package com.voiceclone.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.voiceclone.api.ApiException;
import com.voiceclone.config.MimoSettings;
import com.voiceclone.config.SettingsService;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MimoVoiceCloneService {
    private static final Logger log = LoggerFactory.getLogger(MimoVoiceCloneService.class);
    private static final long MAX_BASE64_BYTES = 10L * 1024L * 1024L;

    private final SettingsService settingsService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public MimoVoiceCloneService(SettingsService settingsService, ObjectMapper objectMapper) {
        this.settingsService = settingsService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    public SynthesisResult synthesize(MultipartFile voiceFile, String text, String stylePrompt) {
        if (voiceFile == null || voiceFile.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请上传一段 mp3、wav 或 m4a 声音样本。");
        }
        return synthesize(readBytes(voiceFile), voiceFile.getOriginalFilename(), voiceFile.getContentType(), text, stylePrompt);
    }

    public SynthesisResult synthesize(byte[] voiceBytes, String originalFilename, String contentType, String text, String stylePrompt) {
        MimoSettings settings = settingsService.getInternalSettings();
        if (!StringUtils.hasText(settings.getApiKey())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请先在设置中填写 MiMo API Key。");
        }
        if (!StringUtils.hasText(text)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请输入要合成的文本。");
        }
        if (voiceBytes == null || voiceBytes.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "请上传一段 mp3、wav 或 m4a 声音样本。");
        }

        VoiceSample voiceSample = prepareVoiceSample(voiceBytes, originalFilename, contentType);
        String voiceBase64 = Base64.getEncoder().encodeToString(voiceSample.bytes());
        if (voiceBase64.length() > MAX_BASE64_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "音频 Base64 编码后超过 10 MB，请换一段更短的样本。");
        }

        Map<String, Object> payload = Map.of(
                "model", "mimo-v2.5-tts-voiceclone",
                "messages", List.of(
                        Map.of("role", "user", "content", stylePrompt == null ? "" : stylePrompt),
                        Map.of("role", "assistant", "content", text)
                ),
                "audio", Map.of(
                        "format", "wav",
                        "voice", "data:" + voiceSample.mimeType() + ";base64," + voiceBase64
                )
        );

        try {
            String json = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(settings.getBaseUrl() + "/chat/completions"))
                    .timeout(Duration.ofMinutes(3))
                    .header("api-key", settings.getApiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            int maxAttempts = 3;
            Exception lastException = null;
            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    long requestStartedAt = System.nanoTime();
                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                    long elapsedMillis = Duration.ofNanos(System.nanoTime() - requestStartedAt).toMillis();
                    log.info("MiMo API completed. status={}, elapsedMs={}, attempt={}", response.statusCode(), elapsedMillis, attempt);
                    if (response.statusCode() < 200 || response.statusCode() >= 300) {
                        log.warn("MiMo API request failed. status={}, body={}", response.statusCode(), response.body());
                        throw buildMimoApiException(response.statusCode(), response.body());
                    }

                    JsonNode root = objectMapper.readTree(response.body());
                    JsonNode audioData = root.path("choices").path(0).path("message").path("audio").path("data");
                    if (audioData.isMissingNode() || !StringUtils.hasText(audioData.asText())) {
                        throw new ApiException(HttpStatus.BAD_GATEWAY, "MiMo API 未返回可用音频。");
                    }
                    return new SynthesisResult(Base64.getDecoder().decode(audioData.asText()), elapsedMillis);
                } catch (ApiException apiException) {
                    throw apiException;
                } catch (Exception exception) {
                    lastException = exception;
                    String message = exception.getMessage() != null ? exception.getMessage() : "";
                    boolean isConnectionError = message.contains("Connection reset")
                            || message.contains("connection reset")
                            || message.contains("Connection refused")
                            || exception instanceof java.net.http.HttpTimeoutException
                            || exception instanceof java.io.IOException;
                    if (isConnectionError && attempt < maxAttempts) {
                        long backoffSeconds = attempt * 5L;
                        log.warn("MiMo API connection error (attempt {}/{}): {}. Retrying in {}s...",
                                attempt, maxAttempts, message, backoffSeconds);
                        Thread.sleep(backoffSeconds * 1000);
                    } else {
                        throw new ApiException(HttpStatus.BAD_GATEWAY, "语音合成失败：" + message);
                    }
                }
            }
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "语音合成失败：重试 " + maxAttempts + " 次后仍无法连接。" +
                    (lastException != null ? " 最后错误：" + lastException.getMessage() : ""));
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "语音合成失败：" + exception.getMessage());
        }
    }

    private ApiException buildMimoApiException(int statusCode, String responseBody) {
        if (statusCode == 401) {
            return new ApiException(HttpStatus.BAD_REQUEST, "MiMo API Key 无效或已过期，请在设置中重新填写。");
        }
        if (statusCode == 403) {
            return new ApiException(HttpStatus.BAD_REQUEST, "MiMo API Key 没有权限调用该模型，请检查账号权限。");
        }
        if (statusCode == 413) {
            return new ApiException(HttpStatus.BAD_REQUEST, "上传音频过大，请换一段更短的样本。");
        }
        return new ApiException(HttpStatus.BAD_GATEWAY, "MiMo API 调用失败：" + extractMimoMessage(responseBody));
    }

    private String extractMimoMessage(String responseBody) {
        if (!StringUtils.hasText(responseBody)) {
            return "远端接口未返回错误详情。";
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode message = root.path("error").path("message");
            if (StringUtils.hasText(message.asText())) {
                return message.asText();
            }
        } catch (Exception ignored) {
            // Fall back to the raw body below.
        }
        return responseBody;
    }

    private VoiceSample prepareVoiceSample(byte[] inputBytes, String originalFilename, String contentType) {
        AudioType audioType = resolveAudioType(originalFilename, contentType);
        if (audioType == AudioType.M4A) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "不支持直接上传 m4a 文件，请前端先转换为 wav 或 mp3 后再上传。");
        }
        return new VoiceSample(inputBytes, audioType.mimeType());
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "读取上传音频失败。");
        }
    }

    private AudioType resolveAudioType(String originalFilename, String contentType) {
        String filename = originalFilename == null ? "" : originalFilename.toLowerCase();
        if ("audio/mpeg".equals(contentType) || "audio/mp3".equals(contentType) || filename.endsWith(".mp3")) {
            return AudioType.MP3;
        }
        if ("audio/wav".equals(contentType) || "audio/x-wav".equals(contentType) || filename.endsWith(".wav")) {
            return AudioType.WAV;
        }
        if ("audio/mp4".equals(contentType)
                || "audio/x-m4a".equals(contentType)
                || "audio/m4a".equals(contentType)
                || filename.endsWith(".m4a")) {
            return AudioType.M4A;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "仅支持 mp3、wav 或 m4a 音频样本。");
    }

    private record VoiceSample(byte[] bytes, String mimeType) {
    }

    public record SynthesisResult(byte[] audioBytes, long mimoElapsedMillis) {
    }

    private enum AudioType {
        MP3("audio/mpeg"),
        WAV("audio/wav"),
        M4A("audio/mp4");

        private final String mimeType;

        AudioType(String mimeType) {
            this.mimeType = mimeType;
        }

        public String mimeType() {
            return mimeType;
        }
    }
}
