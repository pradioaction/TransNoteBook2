#pragma once

#include <vector>
#include <cstdint>

namespace kokoro {

/**
 * Mel spectrogram → PCM 音频波形解码器
 *
 * v1: Griffin-Lim 算法 (零额外模型依赖)
 * v2: HiFi-GAN vocoder (需额外 ONNX 模型)
 */
class AudioDecoder {
public:
    AudioDecoder() = default;

    /**
     * Griffin-Lim 从 mel spectrogram 重建波形
     * @param mel_data    mel 数据 [80 × mel_frames]
     * @param mel_frames  帧数
     * @param sample_rate 采样率
     * @param iterations  迭代次数 (默认 50, 越大音质越好)
     * @return PCM float32 采样 [-1.0, 1.0]
     */
    std::vector<float> DecodeGriffinLim(
        const std::vector<float>& mel_data,
        int mel_frames,
        int sample_rate = 24000,
        int iterations = 50) const;

private:
    // STFT / ISTFT 参数
    static constexpr int kFFTSize = 1024;
    static constexpr int kHopLength = 256;
    static constexpr int kWinLength = 1024;
    static constexpr int kMelBands = 80;

    std::vector<float> HannWindow(int size) const;
    std::vector<float> MelFilterbank(int n_mels, int fft_size, int sample_rate) const;
};

} // namespace kokoro
