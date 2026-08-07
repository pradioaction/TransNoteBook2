#include "audio_decoder.h"

#define _USE_MATH_DEFINES
#include <cmath>
#include <algorithm>
#include <complex>

namespace kokoro {

using Complex = std::complex<double>;

// ============================================================
// 辅助函数
// ============================================================

std::vector<float> AudioDecoder::HannWindow(int size) const {
    std::vector<float> window(size);
    for (int i = 0; i < size; ++i) {
        window[i] = 0.5f - 0.5f * std::cos(2.0 * M_PI * i / (size - 1));
    }
    return window;
}

// Mel 滤波器组 (简化的三角形滤波器)
std::vector<float> AudioDecoder::MelFilterbank(int n_mels, int fft_size,
                                                int sample_rate) const {
    // ... (简化实现: 返回单位矩阵近似值, 后续精确实现)
    return {};
}

// ============================================================
// Griffin-Lim 算法
// ============================================================

// 简单 FFT (N 必须为 2 的幂)
static void FFT(std::vector<Complex>& data, bool inverse) {
    int n = static_cast<int>(data.size());
    if (n <= 1) return;

    // Bit-reversal permutation
    for (int i = 1, j = 0; i < n; ++i) {
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) std::swap(data[i], data[j]);
    }

    // Cooley-Tukey
    for (int len = 2; len <= n; len <<= 1) {
        double angle = 2.0 * M_PI / len * (inverse ? -1.0 : 1.0);
        Complex wlen(std::cos(angle), std::sin(angle));
        for (int i = 0; i < n; i += len) {
            Complex w(1, 0);
            for (int j = 0; j < len / 2; ++j) {
                Complex u = data[i + j];
                Complex v = data[i + j + len / 2] * w;
                data[i + j] = u + v;
                data[i + j + len / 2] = u - v;
                w *= wlen;
            }
        }
    }

    if (inverse) {
        for (auto& c : data) c /= static_cast<double>(n);
    }
}

std::vector<float> AudioDecoder::DecodeGriffinLim(
    const std::vector<float>& mel_data,
    int mel_frames,
    int sample_rate,
    int iterations) const {

    // 简化的 Griffin-Lim 实现
    // 输入: mel_data [80 × mel_frames]
    // 输出: PCM audio samples

    int n_fft = kFFTSize;
    int hop_len = kHopLength;
    int n_mels = kMelBands;
    int fft_bins = n_fft / 2 + 1;

    // 1. Mel → Linear spectrogram (简化: 直接使用 mel 作为频谱幅度近似)
    //    实际需要 mel 滤波器矩阵的伪逆

    // 2. 初始化相位 (随机)
    std::vector<std::vector<double>> phase_frames(mel_frames);
    for (int t = 0; t < mel_frames; ++t) {
        phase_frames[t].resize(fft_bins);
        for (int f = 0; f < fft_bins; ++f) {
            phase_frames[t][f] = 2.0 * M_PI * (rand() / static_cast<double>(RAND_MAX));
        }
    }

    // 3. Griffin-Lim 迭代
    int audio_len = (mel_frames - 1) * hop_len + n_fft;
    std::vector<double> audio(audio_len, 0.0);

    auto hann = HannWindow(n_fft);

    for (int iter = 0; iter < iterations; ++iter) {
        // 使用当前相位构建复数频谱
        std::vector<std::vector<Complex>> stft_frames(mel_frames);
        for (int t = 0; t < mel_frames; ++t) {
            stft_frames[t].resize(fft_bins);
            for (int f = 0; f < fft_bins && f < n_mels; ++f) {
                double mag = (t * n_mels + f < static_cast<int>(mel_data.size()))
                    ? std::abs(static_cast<double>(mel_data[t * n_mels + f]))
                    : 0.0;
                stft_frames[t][f] = Complex(
                    mag * std::cos(phase_frames[t][f]),
                    mag * std::sin(phase_frames[t][f]));
            }
            // 高频补零
            for (int f = n_mels; f < fft_bins; ++f) {
                stft_frames[t][f] = Complex(0, 0);
            }
        }

        // ISTFT → 时域信号
        std::fill(audio.begin(), audio.end(), 0.0);
        std::vector<double> norm(audio_len, 0.0);

        for (int t = 0; t < mel_frames; ++t) {
            // IFFT
            std::vector<Complex> frame(n_fft);
            for (int f = 0; f < fft_bins; ++f) frame[f] = stft_frames[t][f];
            // 共轭对称
            for (int f = fft_bins; f < n_fft; ++f) {
                frame[f] = std::conj(frame[n_fft - f]);
            }

            FFT(frame, true);  // IFFT

            // OLA (Overlap-Add)
            int start = t * hop_len;
            for (int i = 0; i < n_fft && (start + i) < audio_len; ++i) {
                audio[start + i] += frame[i].real() * hann[i];
                norm[start + i] += hann[i];
            }
        }

        // 归一化
        for (int i = 0; i < audio_len; ++i) {
            if (norm[i] > 1e-6) audio[i] /= norm[i];
        }

        // STFT → 更新相位
        for (int t = 0; t < mel_frames; ++t) {
            // 加窗 + FFT
            std::vector<Complex> frame(n_fft, 0);
            int start = t * hop_len;
            for (int i = 0; i < n_fft && (start + i) < audio_len; ++i) {
                frame[i] = Complex(audio[start + i] * hann[i], 0);
            }
            FFT(frame, false);

            // 更新相位
            for (int f = 0; f < fft_bins; ++f) {
                phase_frames[t][f] = std::arg(frame[f]);
            }
        }
    }

    // 4. 转为 float32, 裁剪到 [-1.0, 1.0]
    std::vector<float> samples(audio_len);
    float max_val = 0.0f;
    for (int i = 0; i < audio_len; ++i) {
        samples[i] = static_cast<float>(audio[i]);
        max_val = std::max(max_val, std::abs(samples[i]));
    }
    if (max_val > 0.0f) {
        for (auto& s : samples) s /= max_val;
    }

    return samples;
}

} // namespace kokoro
