#include "sherpa-onnx-tts-wrapper.h"
#include "sherpa-onnx-model-detect.h"
#include <algorithm>
#include <cctype>
#include <cstring>
#include <fstream>
#include <optional>
#include <sstream>

// iOS logging - FORCE REBUILD v2
#ifdef __APPLE__
#include <Foundation/Foundation.h>
#include <cstdio>
#define LOGI(fmt, ...) NSLog(@"TtsWrapper: " fmt, ##__VA_ARGS__)
#define LOGE(fmt, ...) NSLog(@"TtsWrapper ERROR: " fmt, ##__VA_ARGS__)
#else
#define LOGI(...)
#define LOGE(...)
#endif

#include <filesystem>
namespace fs = std::filesystem;

// sherpa-onnx C API header (not C++ API)
#include "sherpa-onnx/c-api/c-api.h"

namespace sherpaonnx {

class TtsWrapper::Impl {
public:
    bool initialized = false;
    std::string modelDir;
    const SherpaOnnxOfflineTts* tts = nullptr;
    int32_t sampleRate = 0;
    int32_t numSpeakers = 0;
};

TtsWrapper::TtsWrapper() : pImpl(std::make_unique<Impl>()) {
    LOGI("TtsWrapper created");
}

TtsWrapper::~TtsWrapper() {
    release();
    LOGI("TtsWrapper destroyed");
}

TtsInitializeResult TtsWrapper::initialize(
    const std::string& modelDir,
    const std::string& modelType,
    int32_t numThreads,
    bool debug,
    const std::optional<float>& noiseScale,
    const std::optional<float>& noiseScaleW,
    const std::optional<float>& lengthScale
) {
    TtsInitializeResult result;
    result.success = false;

    if (pImpl->initialized) {
        release();
    }

    if (modelDir.empty()) {
        LOGE("TTS: Model directory is empty");
        return result;
    }

    try {
        auto detect = DetectTtsModel(modelDir, modelType);
        if (!detect.ok) {
            LOGE("%s", detect.error.c_str());
            return result;
        }

        // Initialize C API config struct (must zero-initialize)
        SherpaOnnxOfflineTtsConfig config;
        memset(&config, 0, sizeof(config));
        
        config.model.num_threads = numThreads;
        config.model.debug = debug ? 1 : 0;

        switch (detect.selectedKind) {
            case TtsModelKind::kVits:
                config.model.vits.model = detect.paths.ttsModel.c_str();
                config.model.vits.tokens = detect.paths.tokens.empty() ? "" : detect.paths.tokens.c_str();
                config.model.vits.data_dir = detect.paths.dataDir.empty() ? "" : detect.paths.dataDir.c_str();
                if (noiseScale.has_value()) {
                    config.model.vits.noise_scale = *noiseScale;
                }
                if (noiseScaleW.has_value()) {
                    config.model.vits.noise_scale_w = *noiseScaleW;
                }
                if (lengthScale.has_value()) {
                    config.model.vits.length_scale = *lengthScale;
                }
                break;
            default:
                LOGE("TTS: Unsupported model type");
                return result;
        }

        LOGI("TTS: Creating OfflineTts instance via C API...");
        LOGI("TTS: Model path: %s", detect.paths.ttsModel.c_str());
        LOGI("TTS: Tokens path: %s", detect.paths.tokens.c_str());
        LOGI("TTS: Data dir: %s", detect.paths.dataDir.c_str());
        LOGI("TTS: Num threads: %d, debug: %d", numThreads, debug ? 1 : 0);
        
        // Verify model file exists before calling sherpa-onnx
        if (!fs::exists(detect.paths.ttsModel)) {
            LOGE("TTS: Model file does not exist: %s", detect.paths.ttsModel.c_str());
            return result;
        }
        LOGI("TTS: Model file verified to exist");
        
        pImpl->tts = SherpaOnnxCreateOfflineTts(&config);

        if (pImpl->tts == nullptr) {
            LOGE("TTS: Failed to create OfflineTts instance - SherpaOnnxCreateOfflineTts returned nullptr");
            LOGE("TTS: This usually means the model file is invalid or incompatible, or espeak-ng-data is missing");
            return result;
        }

        pImpl->initialized = true;
        pImpl->modelDir = modelDir;
        pImpl->sampleRate = SherpaOnnxOfflineTtsSampleRate(pImpl->tts);
        pImpl->numSpeakers = SherpaOnnxOfflineTtsNumSpeakers(pImpl->tts);

        LOGI("TTS: Initialization successful");
        LOGI("TTS: Sample rate: %d Hz", pImpl->sampleRate);
        LOGI("TTS: Number of speakers: %d", pImpl->numSpeakers);

        result.success = true;
        result.detectedModels = detect.detectedModels;
        return result;
    } catch (const std::exception& e) {
        LOGE("TTS: Exception during initialization: %s", e.what());
        return result;
    } catch (...) {
        LOGE("TTS: Unknown exception during initialization");
        return result;
    }
}

TtsWrapper::AudioResult TtsWrapper::generate(
    const std::string& text,
    int32_t sid,
    float speed
) {
    // FIRST LINE OF GENERATE - FORCE REBUILD v3
    LOGI("TTS GENERATE CALLED - v3 - text length: %zu, sid: %d, speed: %.2f", text.length(), sid, speed);
    
    AudioResult result;
    result.sampleRate = 0;

    LOGI("TTS: Checking initialization state...");
    LOGI("TTS: pImpl->initialized = %d", pImpl->initialized ? 1 : 0);
    LOGI("TTS: pImpl->tts = %p", (void*)pImpl->tts);

    if (!pImpl->initialized || pImpl->tts == nullptr) {
        LOGE("TTS: Not initialized. Call initialize() first.");
        return result;
    }

    LOGI("TTS: Initialization check passed");

    if (text.empty()) {
        LOGE("TTS: Input text is empty");
        return result;
    }

    LOGI("TTS: Text not empty, proceeding with generation");

    try {
        LOGI("TTS: Generating speech for text (sid=%d, speed=%.2f)", sid, speed);
        LOGI("TTS: Input text: '%s'", text.c_str());
        LOGI("TTS: Text length: %zu characters", text.length());

        const SherpaOnnxGeneratedAudio* audio = SherpaOnnxOfflineTtsGenerate(
            pImpl->tts, text.c_str(), sid, speed);

        if (audio == nullptr) {
            LOGE("TTS: Generation returned nullptr - phonemization or model inference may have failed");
            return result;
        }
        
        LOGI("TTS: Audio result - n=%d, sample_rate=%d, samples=%p", audio->n, audio->sample_rate, (void*)audio->samples);
        
        if (audio->n == 0) {
            LOGE("TTS: Generation returned empty audio (n=0) - text may not have producible phonemes");
            SherpaOnnxDestroyOfflineTtsGeneratedAudio(audio);
            return result;
        }

        // Copy samples to vector
        result.samples.assign(audio->samples, audio->samples + audio->n);
        result.sampleRate = audio->sample_rate;

        LOGI("TTS: Generated %d samples at %d Hz", audio->n, audio->sample_rate);

        // Free the audio
        SherpaOnnxDestroyOfflineTtsGeneratedAudio(audio);

        return result;
    } catch (const std::exception& e) {
        LOGE("TTS: Exception during generation: %s", e.what());
        return result;
    } catch (...) {
        LOGE("TTS: Unknown exception during generation");
        return result;
    }
}

bool TtsWrapper::generateStream(
    const std::string& text,
    int32_t sid,
    float speed,
    const TtsStreamCallback& callback
) {
    if (!pImpl->initialized || pImpl->tts == nullptr) {
        LOGE("TTS: Not initialized. Call initialize() first.");
        return false;
    }

    if (text.empty()) {
        LOGE("TTS: Input text is empty");
        return false;
    }

    // For streaming, use the callback variant of the C API
    // Not implementing full streaming for now - use generate() instead
    LOGE("TTS: Streaming not implemented in C API wrapper");
    return false;
}

int32_t TtsWrapper::getSampleRate() const {
    if (!pImpl->initialized || pImpl->tts == nullptr) {
        return 0;
    }
    return pImpl->sampleRate;
}

int32_t TtsWrapper::getNumSpeakers() const {
    if (!pImpl->initialized || pImpl->tts == nullptr) {
        return 0;
    }
    return pImpl->numSpeakers;
}

bool TtsWrapper::isInitialized() const {
    return pImpl->initialized;
}

void TtsWrapper::release() {
    if (pImpl->initialized) {
        if (pImpl->tts != nullptr) {
            SherpaOnnxDestroyOfflineTts(pImpl->tts);
            pImpl->tts = nullptr;
        }
        pImpl->initialized = false;
        pImpl->modelDir.clear();
        pImpl->sampleRate = 0;
        pImpl->numSpeakers = 0;
        LOGI("TTS: Resources released");
    }
}

bool TtsWrapper::saveToWavFile(
    const std::vector<float>& samples,
    int32_t sampleRate,
    const std::string& filePath
) {
    if (samples.empty()) {
        LOGE("TTS: Cannot save empty audio samples");
        return false;
    }

    if (sampleRate <= 0) {
        LOGE("TTS: Invalid sample rate: %d", sampleRate);
        return false;
    }

    try {
        std::ofstream outfile(filePath, std::ios::binary);
        if (!outfile) {
            LOGE("TTS: Failed to open output file: %s", filePath.c_str());
            return false;
        }

        const int32_t numChannels = 1;
        const int32_t bitsPerSample = 16;
        const int32_t byteRate = sampleRate * numChannels * bitsPerSample / 8;
        const int32_t blockAlign = numChannels * bitsPerSample / 8;
        const int32_t dataSize = static_cast<int32_t>(samples.size()) * bitsPerSample / 8;
        const int32_t chunkSize = 36 + dataSize;

        outfile.write("RIFF", 4);
        outfile.write(reinterpret_cast<const char*>(&chunkSize), 4);
        outfile.write("WAVE", 4);

        outfile.write("fmt ", 4);
        const int32_t subchunk1Size = 16;
        outfile.write(reinterpret_cast<const char*>(&subchunk1Size), 4);
        const int16_t audioFormat = 1;
        outfile.write(reinterpret_cast<const char*>(&audioFormat), 2);
        const int16_t numChannelsInt16 = static_cast<int16_t>(numChannels);
        outfile.write(reinterpret_cast<const char*>(&numChannelsInt16), 2);
        outfile.write(reinterpret_cast<const char*>(&sampleRate), 4);
        outfile.write(reinterpret_cast<const char*>(&byteRate), 4);
        const int16_t blockAlignInt16 = static_cast<int16_t>(blockAlign);
        outfile.write(reinterpret_cast<const char*>(&blockAlignInt16), 2);
        const int16_t bitsPerSampleInt16 = static_cast<int16_t>(bitsPerSample);
        outfile.write(reinterpret_cast<const char*>(&bitsPerSampleInt16), 2);

        outfile.write("data", 4);
        outfile.write(reinterpret_cast<const char*>(&dataSize), 4);

        for (float sample : samples) {
            float clamped = std::max(-1.0f, std::min(1.0f, sample));
            int16_t intSample = static_cast<int16_t>(clamped * 32767.0f);
            outfile.write(reinterpret_cast<const char*>(&intSample), sizeof(int16_t));
        }

        outfile.close();
        LOGI("TTS: Successfully saved %zu samples to %s", samples.size(), filePath.c_str());
        return true;
    } catch (const std::exception& e) {
        LOGE("TTS: Exception while saving WAV file: %s", e.what());
        return false;
    }
}

} // namespace sherpaonnx
