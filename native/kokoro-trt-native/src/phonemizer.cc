#include "phonemizer.h"
#include <fstream>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <string>

namespace kokoro {

bool Phonemizer::Load(const std::string& model_dir) {
    // 1. 加载英文词典
    std::string en_us = model_dir + "/lexicon-us-en.txt";
    if (!LoadLexicon(en_us)) return false;

    std::string en_gb = model_dir + "/lexicon-gb-en.txt";
    LoadLexicon(en_gb);  // 可选的, 覆盖同名条目

    // 2. 加载中文词典
    std::string zh = model_dir + "/lexicon-zh.txt";
    if (!LoadLexicon(zh)) return false;

    // 3. 从 tokens.txt 加载音素 → ID 映射
    phoneme_to_id_.clear();
    std::string tokens_path = model_dir + "/tokens.txt";
    std::ifstream tf(tokens_path);
    if (tf.is_open()) {
        std::string line;
        while (std::getline(tf, line)) {
            if (line.empty() || line[0] == ';') continue;
            // 格式: "phoneme ID" (空格分隔)
            size_t sep = line.find(' ');
            if (sep == std::string::npos) continue;
            std::string phoneme = line.substr(0, sep);
            int id = std::stoi(line.substr(sep + 1));
            phoneme_to_id_[phoneme] = id;
        }
    }

    return !word_to_phoneme_.empty() || !char_to_phoneme_.empty();
}

bool Phonemizer::LoadLexicon(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) return false;

    std::string line;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#') continue;

        // 格式: word<TAB>p1 p2 p3
        size_t tab = line.find('\t');
        if (tab == std::string::npos) {
            // 空格分隔
            size_t sep = line.find(' ');
            if (sep == std::string::npos) continue;
            std::string word = line.substr(0, sep);
            std::string phonemes = line.substr(sep + 1);
            // 判断是英文还是中文
            bool is_zh = false;
            for (char c : word) {
                if (static_cast<unsigned char>(c) > 0x7F) { is_zh = true; break; }
            }
            if (is_zh) {
                char_to_phoneme_[word] = phonemes;
            } else {
                // 转为小写
                std::transform(word.begin(), word.end(), word.begin(),
                               [](unsigned char c) { return std::tolower(c); });
                word_to_phoneme_[word] = phonemes;
            }
        } else {
            std::string word = line.substr(0, tab);
            std::string phonemes = line.substr(tab + 1);

            bool is_zh = false;
            for (char c : word) {
                if (static_cast<unsigned char>(c) > 0x7F) { is_zh = true; break; }
            }
            if (is_zh) {
                char_to_phoneme_[word] = phonemes;
            } else {
                std::transform(word.begin(), word.end(), word.begin(),
                               [](unsigned char c) { return std::tolower(c); });
                word_to_phoneme_[word] = phonemes;
            }
        }
    }

    file.close();
    return true;
}

std::vector<int32_t> Phonemizer::Phonemize(const std::string& text,
                                            const std::string& lang) const {
    std::vector<std::string> phonemes;

    if (lang == "zh") {
        phonemes = PhonemizeZH(text);
    } else {
        phonemes = PhonemizeEN(text);
    }

    return MapToIds(phonemes);
}

// ============================================================
// 中文音素转换
// ============================================================
std::vector<std::string> Phonemizer::PhonemizeZH(const std::string& text) const {
    std::vector<std::string> phonemes;
    phonemes.push_back("sil");

    for (size_t i = 0; i < text.size(); ) {
        unsigned char c = static_cast<unsigned char>(text[i]);
        int len = 1;

        if (c < 0x80) {
            // ASCII (标点/空格)
            if (c == ' ' || c == ',' || c == '.' || c == '!' || c == '?') {
                phonemes.push_back("sp");
            }
            i += 1;
            continue;
        }
        else if ((c & 0xF0) == 0xE0) len = 3;
        else if ((c & 0xE0) == 0xC0) len = 2;
        else if ((c & 0xF8) == 0xF0) len = 4;

        std::string ch = text.substr(i, len);
        auto it = char_to_phoneme_.find(ch);
        if (it != char_to_phoneme_.end()) {
            // 切分音素字符串
            std::istringstream iss(it->second);
            std::string p;
            while (iss >> p) {
                phonemes.push_back(p);
            }
        }
        // 未命中: 跳过 (或尝试拼音推断)

        i += len;
    }

    phonemes.push_back("sil");
    return phonemes;
}

// ============================================================
// 英文音素转换
// ============================================================
std::vector<std::string> Phonemizer::PhonemizeEN(const std::string& text) const {
    std::vector<std::string> phonemes;
    phonemes.push_back("sil");

    // 简单分词 + 查表
    std::string word;
    auto flush_word = [&]() {
        if (word.empty()) return;
        std::string lower = word;
        std::transform(lower.begin(), lower.end(), lower.begin(),
                       [](unsigned char c) { return std::tolower(c); });

        auto it = word_to_phoneme_.find(lower);
        if (it != word_to_phoneme_.end()) {
            std::istringstream iss(it->second);
            std::string p;
            while (iss >> p) phonemes.push_back(p);
        }
        // 未命中: 跳过 (后续可接入 G2P 规则)
        word.clear();
    };

    for (char c : text) {
        if (std::isalpha(static_cast<unsigned char>(c)) || c == '\'') {
            word += c;
        } else {
            flush_word();
            if (c == ' ' || c == ',' || c == '.' || c == '!' || c == '?') {
                phonemes.push_back("sp");
            }
        }
    }
    flush_word();

    phonemes.push_back("sil");
    return phonemes;
}

// ============================================================
// 音素字符串 → ID 映射
// ============================================================
std::vector<int32_t> Phonemizer::MapToIds(const std::vector<std::string>& phonemes) const {
    std::vector<int32_t> ids;
    ids.reserve(phonemes.size());

    for (const auto& p : phonemes) {
        auto it = phoneme_to_id_.find(p);
        if (it != phoneme_to_id_.end()) {
            ids.push_back(it->second);
        } else {
            ids.push_back(0);  // fallback: sil
        }
    }

    return ids;
}

} // namespace kokoro
