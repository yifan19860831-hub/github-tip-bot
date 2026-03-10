# GitHub Tip Bot 馃馃挵

涓€涓狦itHub Action锛岃鐢ㄦ埛鍙互鍦℅itHub璇勮涓彂閫?`/tip @user 5 RTC` 鏉ユ墦璧忚础鐚€呫€?
## 鍔熻兘鐗规€?
### 鍩虹鍔熻兘 (25 RTC)
- 鉁?`/tip @user 5 RTC` - 鍚戞寚瀹氱敤鎴锋墦璧廟TC浠ｅ竵
- 鉁?鏉冮檺楠岃瘉 - 鍙湁浠撳簱鍗忎綔鑰呭拰Issue浣滆€呭彲浠ュ彂閫佹墦璧?- 鉁?閽卞寘楠岃瘉 - 楠岃瘉鎺ユ敹鑰呮槸鍚﹀凡娉ㄥ唽閽卞寘
- 鉁?RustChain API闆嗘垚 - 閫氳繃API鎵ц杞处
- 鉁?纭璇勮 - 鑷姩鍙戝竷鎵撹祻缁撴灉

### 濂栭噾鍔熻兘 (40 RTC)
- 鉁?`/balance` - 鏌ヨ璐︽埛浣欓
- 鉁?`/leaderboard` - 鏌ョ湅鎵撹祻鎺掕姒?- 鉁?`/register <wallet_address>` - 娉ㄥ唽閽卞寘鍦板潃
- 鉁?姣忔棩鎽樿 - 鑷姩鍙戦€佹瘡鏃ユ墦璧忕粺璁?
## 浣跨敤鏂规硶

### 1. 瀹夎

鍦ㄤ綘鐨勪粨搴撲腑鍒涘缓 `.github/workflows/tip-bot.yml`:

```yaml
name: GitHub Tip Bot

on:
  issue_comment:
    types: [created]

jobs:
  tip-bot:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - uses: yifan19860831-hub/github-tip-bot@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          rustchain-api-url: ${{ secrets.RUSTCHAIN_API_URL }}
          rustchain-api-key: ${{ secrets.RUSTCHAIN_API_KEY }}
```

### 2. 閰嶇疆Secrets

鍦ㄤ粨搴撹缃腑娣诲姞浠ヤ笅Secrets:
- `RUSTCHAIN_API_URL` - RustChain API鍦板潃
- `RUSTCHAIN_API_KEY` - RustChain API瀵嗛挜

### 3. 浣跨敤鍛戒护

鍦↖ssue鎴朠R璇勮涓娇鐢ㄤ互涓嬪懡浠?

| 鍛戒护 | 璇存槑 | 绀轰緥 |
|------|------|------|
| `/tip @user 5 RTC` | 鎵撹祻鎸囧畾鐢ㄦ埛 | `/tip @alice 5 RTC` |
| `/balance` | 鏌ヨ浣欓 | `/balance` |
| `/leaderboard` | 鏌ョ湅鎺掕姒?| `/leaderboard` |
| `/register <address>` | 娉ㄥ唽閽卞寘 | `/register abc123...` |

## 鍛戒护璇﹁В

### /tip 鍛戒护
```
/tip @username 5 RTC
```
- 鍚戞寚瀹氱敤鎴峰彂閫?涓猂TC浠ｅ竵
- 鍙戦€佽€呭繀椤绘湁瓒冲浣欓
- 鎺ユ敹鑰呭繀椤诲凡娉ㄥ唽閽卞寘
- 鍙湁浠撳簱鍗忎綔鑰呭拰Issue浣滆€呭彲浠ヤ娇鐢?
### /balance 鍛戒护
```
/balance
```
- 鏄剧ず褰撳墠鐢ㄦ埛鐨凴TC浣欓
- 鏄剧ず宸叉敞鍐岀殑閽卞寘鍦板潃

### /leaderboard 鍛戒护
```
/leaderboard
```
- 鏄剧ず鍙戦€佹渶澶氱殑鍓?鍚嶇敤鎴?- 鏄剧ず鎺ユ敹鏈€澶氱殑鍓?鍚嶇敤鎴?
### /register 鍛戒护
```
/register <wallet_address>
```
- 娉ㄥ唽閽卞寘鍦板潃
- 鏂扮敤鎴锋敞鍐岃幏寰?00 RTC鍒濆濂栧姳

## 鎶€鏈灦鏋?
```
GitHub Comment
    鈫?GitHub Actions Workflow
    鈫?tip-bot.js (Node.js)
    鈫?RustChain API (/wallet/transfer)
    鈫?Blockchain Transaction
    鈫?Confirmation Comment
```

## 鏂囦欢缁撴瀯

```
github-tip-bot/
鈹溾攢鈹€ .github/
鈹?  鈹斺攢鈹€ workflows/
鈹?      鈹斺攢鈹€ tip-bot.yml      # GitHub Actions宸ヤ綔娴?鈹溾攢鈹€ src/
鈹?  鈹溾攢鈹€ index.js             # 鍏ュ彛鏂囦欢
鈹?  鈹斺攢鈹€ tip-bot.js           # 鏍稿績閫昏緫
鈹溾攢鈹€ action.yml               # Action閰嶇疆
鈹溾攢鈹€ package.json             # 渚濊禆閰嶇疆
鈹斺攢鈹€ README.md                # 璇存槑鏂囨。
```

## API闆嗘垚

### RustChain杞处API

```http
POST /wallet/transfer
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "from": "sender_wallet_address",
  "to": "recipient_wallet_address",
  "amount": 5,
  "token": "RTC"
}
```

## 鏉冮檺鎺у埗

鍙戦€佹墦璧忛渶瑕佹弧瓒充互涓嬫潯浠朵箣涓€:
1. 浠撳簱绠＄悊鍛?(admin)
2. 浠撳簱鍐欏叆鏉冮檺 (write)
3. 浠撳簱缁存姢鏉冮檺 (maintain)
4. Issue/PR鐨勪綔鑰?
## 寮€鍙?
```bash
# 瀹夎渚濊禆
npm install

# 鏋勫缓
npm run build

# 娴嬭瘯
npm test
```

## 璁稿彲璇?
MIT

## 璐＄尞

娆㈣繋鎻愪氦Issue鍜孭ull Request锛?
## 璧忛噾浠诲姟

鏈」鐩负 [RustChain Bounties](https://github.com/Scottcjn/rustchain-bounties) 浠诲姟:
- 鍩虹鍔熻兘: 25 RTC
- 濂栭噾鍔熻兘: 40 RTC
