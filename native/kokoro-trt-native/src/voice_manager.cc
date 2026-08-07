#include "voice_manager.h"
#include <fstream>
#include <cstring>

namespace kokoro {

bool VoiceManager::Load(const std::string& voices_bin_path,
                         const std::string& model_dir) {
    std::ifstream file(voices_bin_path, std::ios::binary);
    if (!file.is_open()) return false;

    // 读取文件大小, 推断 embed_dim 和 num_voices
    file.seekg(0, std::ios::end);
    size_t file_size = static_cast<size_t>(file.tellg());
    file.seekg(0, std::ios::beg);

    // Kokoro: embed_dim = 256
    embed_dim_ = 256;
    size_t num_voices = file_size / (embed_dim_ * sizeof(float));

    if (num_voices == 0) return false;

    // 构建默认语音列表
    BuildDefaultVoiceList();

    // 读取嵌入向量
    for (size_t i = 0; i < num_voices && i < voice_list_.size(); ++i) {
        std::vector<float> emb(embed_dim_);
        file.read(reinterpret_cast<char*>(emb.data()),
                  embed_dim_ * sizeof(float));
        embeddings_[voice_list_[i].voice_id] = std::move(emb);
    }

    file.close();
    return !embeddings_.empty();
}

const std::vector<float>* VoiceManager::GetEmbedding(
    const std::string& voice_id) const {
    auto it = embeddings_.find(voice_id);
    return (it != embeddings_.end()) ? &it->second : nullptr;
}

const VoiceInfo* VoiceManager::GetInfo(const std::string& voice_id) const {
    for (const auto& v : voice_list_) {
        if (v.voice_id == voice_id) return &v;
    }
    return nullptr;
}

std::vector<VoiceInfo> VoiceManager::ListVoices(
    const std::string& lang_filter) const {
    if (lang_filter.empty()) return voice_list_;

    std::vector<VoiceInfo> filtered;
    for (const auto& v : voice_list_) {
        if (v.lang.find(lang_filter) != std::string::npos) {
            filtered.push_back(v);
        }
    }
    return filtered;
}

// ============================================================
// Kokoro v1.0 内置语音 (voices.bin 中的顺序)
// 元信息来自 Kokoro 官方仓库
// ============================================================
void VoiceManager::BuildDefaultVoiceList() {
    voice_list_ = {
        // 美式英语
        {"af_heart"    , "Heart"          , "en", "F"},
        {"af_bella"    , "Bella"          , "en", "F"},
        {"af_nicole"   , "Nicole"         , "en", "F"},
        {"af_aoede"    , "Aoede"          , "en", "F"},
        {"af_kore"     , "Kore"           , "en", "F"},
        {"af_sarah"    , "Sarah"          , "en", "F"},
        {"af_nova"     , "Nova"           , "en", "F"},
        {"af_sky"      , "Sky"            , "en", "F"},
        {"af_alloy"    , "Alloy"          , "en", "F"},
        {"af_jessica"  , "Jessica"        , "en", "F"},
        {"af_river"    , "River"          , "en", "F"},
        {"am_michael"  , "Michael"        , "en", "M"},
        {"am_fenrir"   , "Fenrir"         , "en", "M"},
        {"am_puck"     , "Puck"           , "en", "M"},
        {"am_liam"     , "Liam"           , "en", "M"},
        {"am_onyx"     , "Onyx"           , "en", "M"},
        {"am_adam"     , "Adam"           , "en", "M"},
        {"am_echo"     , "Echo"           , "en", "M"},
        {"am_eric"     , "Eric"           , "en", "M"},
        // 英式英语
        {"bf_alice"    , "Alice"          , "en-GB", "F"},
        {"bf_emma"     , "Emma"           , "en-GB", "F"},
        {"bf_isabella" , "Isabella"       , "en-GB", "F"},
        {"bf_lily"     , "Lily"           , "en-GB", "F"},
        {"bm_daniel"   , "Daniel"         , "en-GB", "M"},
        {"bm_fable"    , "Fable"          , "en-GB", "M"},
        {"bm_george"   , "George"         , "en-GB", "M"},
        {"bm_lewis"    , "Lewis"          , "en-GB", "M"},
        // 中文
        {"zf_xiaobei"  , "Xiaobei"        , "zh", "F"},
        {"zf_xiaoni"   , "Xiaoni"         , "zh", "F"},
        {"zf_xiaoxiao" , "Xiaoxiao"       , "zh", "F"},
        {"zf_xiaoyi"   , "Xiaoyi"         , "zh", "F"},
        {"zm_yunjian"  , "Yunjian"        , "zh", "M"},
        {"zm_yunxi"    , "Yunxi"          , "zh", "M"},
        {"zm_yunxia"   , "Yunxia"         , "zh", "M"},
        {"zm_yunyang"  , "Yunyang"        , "zh", "M"},
        // 日语
        {"jf_alpha"    , "Alpha"          , "ja", "F"},
        {"jf_gongitsune", "Gongitsune"    , "ja", "F"},
        {"jf_nezumi"   , "Nezumi"         , "ja", "F"},
        {"jf_tebukuro" , "Tebukuro"       , "ja", "F"},
        {"jm_kumo"     , "Kumo"           , "ja", "M"},
        // 法语
        {"ff_siwis"    , "Siwis"          , "fr", "F"},
        // 韩语
        {"kf_konglish" , "Konglish"       , "ko", "F"},
        // 葡萄牙语
        {"pf_dora"     , "Dora"           , "pt-BR", "F"},
        // 西班牙语
        {"ef_dora"     , "Dora"           , "es", "F"},
        // 其他
        {"hf_alpha"    , "Alpha"          , "hi", "F"},
        {"if_sara"     , "Sara"           , "it", "F"},
    };
}

} // namespace kokoro
