#include "sherpa-onnx-model-detect.h"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <string>
#include <vector>

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
    
    bool hasVits = FileExists(modelOnnx) || FileExists(modelFp16) || FileExists(modelInt8) || FileExists(piperModel);
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

    // Find the model file
    std::string ttsModel;
    if (FileExists(piperModel)) {
        ttsModel = piperModel;
    } else if (FileExists(modelInt8)) {
        ttsModel = modelInt8;
    } else if (FileExists(modelFp16)) {
        ttsModel = modelFp16;
    } else if (FileExists(modelOnnx)) {
        ttsModel = modelOnnx;
    }

    // Check for Piper JSON config (alternative to tokens.txt)
    std::string piperJson = modelDir + "/" + dirName + ".onnx.json";
    if (!FileExists(tokensFile) && FileExists(piperJson)) {
        // Piper models use JSON config, tokens embedded
        tokensFile = "";
    }

    result.selectedKind = selected;
    result.paths.ttsModel = ttsModel;
    result.paths.tokens = tokensFile;
    result.paths.dataDir = hasDataDir ? dataDirPath : "";

    result.ok = true;
    return result;
}

} // namespace sherpaonnx
