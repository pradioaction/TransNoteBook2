/**
 * phonemizer.h — 文本 → 音素序列
 *
 * 使用 Kokoro 模型自带的词典文件:
 *   - lexicon-us-en.txt / lexicon-gb-en.txt → 英文单词 → 音素
 *   - lexicon-zh.txt + phone-zh.fst → 中文 → 音素
 */

#pragma once

#include <string>
#include <vector>
#include <unordered_map>

namespace kokoro {

class Phonemizer {
public:
    Phonemizer() = default;

    /**
     * 加载发音词典
     * @param model_dir 模型根目录 (包含 lexicon-*.txt, phone-zh.fst 等)
     */
    bool Load(const std::string& model_dir);

    /**
     * 文本 → 音素 ID 序列
     * @param text 输入文本
     * @param lang 语言标签 ("en" / "zh" / "ja")
     */
    std::vector<int32_t> Phonemize(const std::string& text,
                                    const std::string& lang) const;

    /** 音素表大小 */
    size_t PhonemeCount() const { return phoneme_to_id_.size(); }

    bool IsLoaded() const { return !phoneme_to_id_.empty(); }

private:
    /** 加载 lexicon 文件 (每行: word<TAB>phoneme) */
    bool LoadLexicon(const std::string& path);

    /** 英文: 查词典, 未命中则用规则推断 */
    std::vector<std::string> PhonemizeEN(const std::string& text) const;

    /** 中文: 查词典 + pinyin 映射 */
    std::vector<std::string> PhonemizeZH(const std::string& text) const;

    /** 音素字符串 → ID */
    std::vector<int32_t> MapToIds(const std::vector<std::string>& phonemes) const;

    std::unordered_map<std::string, std::string> word_to_phoneme_;  // 英文
    std::unordered_map<std::string, std::string> char_to_phoneme_;  // 中文
    std::unordered_map<std::string, int32_t> phoneme_to_id_;
};

} // namespace kokoro
