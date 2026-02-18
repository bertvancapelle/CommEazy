#include "sherpa-onnx-model-detect.h"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <string>
#include <vector>

// iOS logging
#ifdef __APPLE__
#include <Foundation/Foundation.h>
#include <cstdio>
#define LOGD(fmt, ...) NSLog(@"ModelDetect: " fmt, ##__VA_ARGS__)
#else
#define LOGD(...)
#endif

namespace fs = std::filesystem;

namespace sherpaonnx {
namespace {

bool FileExists(const std::string& path) {
    return fs::exists(path);
}

bool IsDirectory(const std::string& path) {
    return fs::is_directory(path);
}

std::string ToLower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return value;
}

TtsModelKind ParseTtsModelType(const std::string& modelType) {
    if (modelType == "vits") return TtsModelKind::kVits;
    if (modelType == "matcha") return TtsModelKind::kMatcha;
    if (modelType == "kokoro") return TtsModelKind::kKokoro;
    if (modelType == "kitten") return TtsModelKind::kKitten;
    if (modelType == "zipvoice") return TtsModelKind::kZipvoice;
    return TtsModelKind::kUnknown;
}

} // namespace

SttDetectResult DetectSttModel(
    const std::string& modelDir,
    const std::optional<bool>& preferInt8,
    const std::optional<std::string>& modelType
) {
    SttDetectResult result;
    result.error = "STT detection not implemented for this build";
    return result;
}

TtsDetectResult DetectTtsModel(const std::string& modelDir, const std::string& modelType) {
    TtsDetectResult result;

    if (modelDir.empty()) {
        result.error = "TTS: Model directory is empty";
        return result;
    }

    if (!FileExists(modelDir) || !IsDirectory(modelDir)) {
        result.error = "TTS: Model directory does not exist or is not a directory: " + modelDir;
        return result;
    }

    std::string modelOnnx = modelDir + "/model.onnx";
    std::string modelFp16 = modelDir + "/model.fp16.onnx";
    std::string modelInt8 = modelDir + "/model.int8.onnx";
    std::string tokensFile = modelDir + "/tokens.txt";
    std::string dataDirPath = modelDir + "/espeak-ng-data";

    // Check for Piper-style ONNX model (name matches directory)
    std::string dirName = fs::path(modelDir).filename().string();
    std::string piperModel = modelDir + "/" + dirName + ".onnx";
    
    // Also check for flat bundle structure where files are directly in bundle root
    // with specific Piper model naming (nl_NL-mls-medium.onnx)
    std::string flatPiperModel = modelDir + "/nl_NL-mls-medium.onnx";
    std::string flatPiperJson = modelDir + "/nl_NL-mls-medium.onnx.json";
    
    LOGD("Checking model paths:");
    LOGD("  modelDir: %s", modelDir.c_str());
    LOGD("  piperModel (dir-based): %s exists=%d", piperModel.c_str(), FileExists(piperModel));
    LOGD("  flatPiperModel: %s exists=%d", flatPiperModel.c_str(), FileExists(flatPiperModel));
    LOGD("  modelOnnx: %s exists=%d", modelOnnx.c_str(), FileExists(modelOnnx));
    LOGD("  dataDirPath: %s exists=%d", dataDirPath.c_str(), IsDirectory(dataDirPath));
    
    bool hasVits = FileExists(modelOnnx) || FileExists(modelFp16) || FileExists(modelInt8) || 
                   FileExists(piperModel) || FileExists(flatPiperModel);
    bool hasDataDir = IsDirectory(dataDirPath);

    if (hasVits) {
        result.detectedModels.push_back({"vits", modelDir});
    }

    TtsModelKind selected = TtsModelKind::kUnknown;
    if (modelType != "auto") {
        selected = ParseTtsModelType(modelType);
    } else if (hasVits) {
        selected = TtsModelKind::kVits;
    }

    if (selected == TtsModelKind::kUnknown) {
        result.error = "TTS: No compatible model type detected in " + modelDir;
        return result;
    }

    // Find the model file - check flat bundle first (most common for iOS)
    std::string ttsModel;
    if (FileExists(flatPiperModel)) {
        ttsModel = flatPiperModel;
    } else if (FileExists(piperModel)) {
        ttsModel = piperModel;
    } else if (FileExists(modelInt8)) {
        ttsModel = modelInt8;
    } else if (FileExists(modelFp16)) {
        ttsModel = modelFp16;
    } else if (FileExists(modelOnnx)) {
        ttsModel = modelOnnx;
    }

    // Sherpa-ONNX requires a tokens.txt file even for Piper models
    // Check multiple possible locations
    std::string flatTokensFile = modelDir + "/tokens.txt";
    
    LOGD("  tokensFile (default): %s exists=%d", tokensFile.c_str(), FileExists(tokensFile));
    LOGD("  flatTokensFile: %s exists=%d", flatTokensFile.c_str(), FileExists(flatTokensFile));
    
    if (FileExists(flatTokensFile)) {
        tokensFile = flatTokensFile;
    } else if (!FileExists(tokensFile)) {
        // No tokens file found - this will cause an error
        LOGD("WARNING: No tokens.txt file found!");
        tokensFile = "";
    }

    result.selectedKind = selected;
    result.paths.ttsModel = ttsModel;
    result.paths.tokens = tokensFile;
    result.paths.dataDir = hasDataDir ? dataDirPath : "";

    LOGD("Detection result:");
    LOGD("  ttsModel: %s", result.paths.ttsModel.c_str());
    LOGD("  tokens: %s", result.paths.tokens.c_str());
    LOGD("  dataDir: %s", result.paths.dataDir.c_str());
    LOGD("  hasVits: %d", hasVits);

    // Verify we actually found a model file
    if (ttsModel.empty()) {
        result.error = "TTS: No model file found in " + modelDir;
        LOGD("ERROR: No model file found!");
        return result;
    }

    result.ok = true;
    return result;
}

} // namespace sherpaonnx
