#pragma once

#include "kokoro_engine.h"
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>

namespace kokoro {

/**
 * 语音管理: 加载 voices.bin 中的语音嵌入向量
 *
 * voices.bin 格式: [num_voices × embed_dim] float32 数组
 * Kokoro: ~120 个 voice, 每个 256 维
 */
class VoiceManager {
public:
    VoiceManager() = default;

    /**
     * 加载语音数据
     * @param voices_bin_path  voices.bin 路径
     * @param model_dir        模型目录 (用于解析语音元信息)
     */
    bool Load(const std::string& voices_bin_path,
              const std::string& model_dir);

    /** 获取语音嵌入向量 (256 维 float) */
    const std::vector<float>* GetEmbedding(const std::string& voice_id) const;

    /** 获取语音元信息 */
    const VoiceInfo* GetInfo(const std::string& voice_id) const;

    /** 列出所有可用语音 */
    std::vector<VoiceInfo> ListVoices(const std::string& lang_filter = "") const;

    /** 嵌入向量维度 */
    int EmbedDim() const { return embed_dim_; }

    /** 语音数量 */
    size_t Count() const { return voice_list_.size(); }

    bool IsLoaded() const { return !voice_list_.empty(); }

private:
    int embed_dim_ = 0;
    std::unordered_map<std::string, std::vector<float>> embeddings_;
    std::vector<VoiceInfo> voice_list_;

    // Kokoro 内置语音列表 (voices.bin 没有元信息, 需硬编码或从文件名推断)
    void BuildDefaultVoiceList();
};

} // namespace kokoro
