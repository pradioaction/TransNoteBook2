#include "tokenizer.h"
#include <fstream>
#include <codecvt>
#include <locale>
#include <cmath>

namespace kokoro {

bool Tokenizer::Load(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) return false;

    token_to_id_.clear();
    std::string line;
    int32_t id = 0;

    while (std::getline(file, line)) {
        if (line.empty()) continue;
        token_to_id_[line] = id++;
    }

    file.close();

    // 查找特殊 token
    auto find_id = [this](const std::string& t) -> int32_t {
        auto it = token_to_id_.find(t);
        return (it != token_to_id_.end()) ? it->second : -1;
    };

    int32_t p = find_id("[PAD]"); pad_id_ = (p >= 0) ? p : 0;
    int32_t b = find_id("[BOS]"); bos_id_ = (b >= 0) ? b : 1;
    int32_t e = find_id("[EOS]"); eos_id_ = (e >= 0) ? e : 2;
    int32_t u = find_id("[UNK]"); unk_id_ = (u >= 0) ? u : 3;

    return !token_to_id_.empty();
}

std::vector<std::string> Tokenizer::TokenizeUTF8(const std::string& text) const {
    // 使用 Kokoro 的 BPE 风格分词: 按字符 + 标点边界切分
    std::vector<std::string> tokens;
    std::string current;

    for (size_t i = 0; i < text.size(); ) {
        unsigned char c = static_cast<unsigned char>(text[i]);

        // ASCII
        if (c < 0x80) {
            if (c == ' ') {
                if (!current.empty()) { tokens.push_back(current); current.clear(); }
                current += c;
                tokens.push_back(current);
                current.clear();
            } else if (c == ',' || c == '.' || c == '!' || c == '?' ||
                       c == ';' || c == ':' || c == '\'' || c == '\"') {
                if (!current.empty()) { tokens.push_back(current); current.clear(); }
                current += c;
                tokens.push_back(current);
                current.clear();
            } else {
                current += c;
            }
            i += 1;
        }
        // 2-byte UTF-8
        else if ((c & 0xE0) == 0xC0) {
            if (!current.empty() && !current.empty() && (current.back() & 0x80) == 0) {
                tokens.push_back(current);
                current.clear();
            }
            current += text.substr(i, 2);
            i += 2;
        }
        // 3-byte UTF-8 (CJK)
        else if ((c & 0xF0) == 0xE0) {
            if (!current.empty() && (static_cast<unsigned char>(current.back()) < 0x80 || current.back() == ' ')) {
                tokens.push_back(current);
                current.clear();
            }
            current += text.substr(i, 3);
            i += 3;
        }
        // 4-byte UTF-8
        else if ((c & 0xF8) == 0xF0) {
            current += text.substr(i, 4);
            i += 4;
        }
        else {
            current += c;
            i += 1;
        }
    }

    if (!current.empty()) tokens.push_back(current);

    return tokens;
}

std::vector<int32_t> Tokenizer::Encode(const std::string& text) const {
    if (token_to_id_.empty()) return {};

    auto tokens = TokenizeUTF8(text);
    std::vector<int32_t> ids;
    ids.reserve(std::min(tokens.size() + 2, static_cast<size_t>(max_seq_len_)));

    ids.push_back(bos_id_);

    for (const auto& token : tokens) {
        if (static_cast<int32_t>(ids.size()) >= max_seq_len_ - 1) break;

        auto it = token_to_id_.find(token);
        if (it != token_to_id_.end()) {
            ids.push_back(it->second);
        } else {
            // 子词级回退: 逐字符编码
            for (size_t i = 0; i < token.size(); ) {
                unsigned char c = static_cast<unsigned char>(token[i]);
                int len = 1;
                if ((c & 0xF0) == 0xE0) len = 3;
                else if ((c & 0xE0) == 0xC0) len = 2;
                else if ((c & 0xF8) == 0xF0) len = 4;

                std::string sub = token.substr(i, len);
                auto sit = token_to_id_.find(sub);
                ids.push_back((sit != token_to_id_.end()) ? sit->second : unk_id_);
                i += len;
            }
        }
    }

    ids.push_back(eos_id_);
    return ids;
}

} // namespace kokoro
