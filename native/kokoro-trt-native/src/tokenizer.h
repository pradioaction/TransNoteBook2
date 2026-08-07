/**
 * tokenizer.h — Kokoro Tokenizer
 *
 * 功能:
 *   1. 加载 model/tokens.txt 构建 token → ID 映射
 *   2. 将 UTF-8 文本转为 token ID 序列
 *   3. 处理特殊 token (BOS, EOS, PAD, UNK)
 *
 * tokens.txt 格式: 每行一个 token, 行号即 ID
 */

#pragma once

#include <string>
#include <vector>
#include <unordered_map>

namespace kokoro {

class Tokenizer {
public:
    Tokenizer() = default;

    /** 从 tokens.txt 加载词表 */
    bool Load(const std::string& tokens_path);

    /** UTF-8 文本 → token ID 序列 */
    std::vector<int32_t> Encode(const std::string& text) const;

    /** 获取模型最大序列长度 */
    int32_t MaxLength() const { return max_seq_len_; }

    /** 词表大小 */
    size_t VocabSize() const { return token_to_id_.size(); }

    /** 特殊 token ID */
    int32_t PadId() const { return pad_id_; }
    int32_t BosId() const { return bos_id_; }
    int32_t EosId() const { return eos_id_; }

    bool IsLoaded() const { return !token_to_id_.empty(); }

private:
    /** UTF-8 字符 → 字节序列 → token 匹配 */
    std::vector<std::string> TokenizeUTF8(const std::string& text) const;

    std::unordered_map<std::string, int32_t> token_to_id_;
    int32_t pad_id_ = 0;
    int32_t bos_id_ = 1;
    int32_t eos_id_ = 2;
    int32_t unk_id_ = 3;
    int32_t max_seq_len_ = 510;
};

} // namespace kokoro
