// ========================================
// 小P 百家樂預測系統 - Web 版 PredictionEngine
// ========================================

class PredictionEngine {
    constructor() {
        // 三種預測邏輯的權重（之後可以依實戰調整）
        this.weights = {
            pattern: 0.4,     // 型態預測（大路）
            cardPoints: 0.3,  // 牌點數 / 牌型
            downRoad: 0.3     // 下三路顏色共識
        };
    }

    /**
     * 主預測函式
     * input 格式：
     * beadRoad: ['B','P',...]
     * bankerCards: [4,6,0]
     * playerCards: [9,1]
     * downRoad: { bigEye: ['R'], smallRoad: ['B'], cockroach: ['R'] }
     */
    predictNext(input) {
        const {
            beadRoad = [],
            bankerCards = [],
            playerCards = [],
            downRoad = {}
        } = input || {};

        const patternScore = this._evaluatePattern(beadRoad);
        const cardScore = this._evaluateCardPoints(bankerCards, playerCards);
        const downRoadScore = this._evaluateDownRoad(downRoad);

        const totalScore =
            patternScore * this.weights.pattern +
            cardScore * this.weights.cardPoints +
            downRoadScore * this.weights.downRoad;

        const result = this._scoreToDecision(totalScore);
        const confidence = Math.min(1, Math.abs(totalScore));

        return {
            side: result.side,         // 'BANKER' | 'PLAYER'
            sideText: result.sideText, // '莊' / '閒'
            confidence,
            raw: {
                patternScore,
                cardScore,
                downRoadScore,
                totalScore
            }
        };
    }

    // 1. 型態預測（大路）
    _evaluatePattern(beadRoad) {
        if (!beadRoad || beadRoad.length === 0) return 0;

        const last = beadRoad[beadRoad.length - 1];  // 最後一局
        const recent = beadRoad.slice(-10);          // 最近 10 局

        const bankerCount = recent.filter(r => r === 'B').length;
        const playerCount = recent.filter(r => r === 'P').length;

        let bias = 0;
        if (bankerCount + playerCount > 0) {
            bias = (bankerCount - playerCount) / (bankerCount + playerCount);
        }

        const lastBonus = last === 'B' ? 0.1 : last === 'P' ? -0.1 : 0;
        return bias + lastBonus; // 約在 -1 ~ 1 之間
    }

    // 2. 牌點數 / 牌型預測
    _evaluateCardPoints(bankerCards, playerCards) {
        if (!Array.isArray(bankerCards) || !Array.isArray(playerCards)) return 0;

        const bankerTotal = this._baccaratPointSum(bankerCards);
        const playerTotal = this._baccaratPointSum(playerCards);
        const diff = bankerTotal - playerTotal;

        // 示範：上一局點數高的一方，下局略不利
        if (diff > 0) return -0.3; // 莊高 → 偏閒
        if (diff < 0) return 0.3;  // 閒高 → 偏莊
        return 0;                  // 平點 → 中立
    }

    // 計算百家樂點數（10/J/Q/K = 0）
    _baccaratPointSum(cards) {
        let sum = 0;
        for (const c of cards) {
            const v = Number(c);
            if (isNaN(v)) continue;
            const point = v >= 10 ? 0 : v;
            sum += point;
        }
        return sum % 10;
    }

    // 3. 下三路顏色共識
    _evaluateDownRoad(downRoad) {
        const { bigEye = [], smallRoad = [], cockroach = [] } = downRoad || {};

        const lastBig = bigEye[bigEye.length - 1];
        const lastSmall = smallRoad[smallRoad.length - 1];
        const lastCockroach = cockroach[cockroach.length - 1];

        let score = 0;

        const toScore = (color) => {
            if (color === 'R') return 0.5;   // 紅 → 偏莊
            if (color === 'B') return -0.5;  // 藍 → 偏閒
            return 0;
        };

        score += toScore(lastBig);
        score += toScore(lastSmall);
        score += toScore(lastCockroach);

        // 三路同色時大約 ±1.5，這裡除以 1.5 正規化到 -1 ~ 1
        return score / 1.5;
    }

    // 分數轉成實際下注建議
    _scoreToDecision(totalScore) {
        if (totalScore > 0.05) {
            return { side: 'BANKER', sideText: '莊' };
        } else if (totalScore < -0.05) {
            return { side: 'PLAYER', sideText: '閒' };
        } else {
            // 接近 0 → 視為低信心，暫時也偏閒
            return { side: 'PLAYER', sideText: '閒' };
        }
    }
}

// ==========================================================
// 與畫面連動的程式碼
// ==========================================================

const predictionEngine = new PredictionEngine();

// 取得畫面元素
const predictionResultEl = document.getElementById("predictionResult");
const logAreaEl = document.getElementById("logArea");

const beadRoadInputEl = document.getElementById("beadRoadInput");
const bankerCardsInputEl = document.getElementById("bankerCardsInput");
const playerCardsInputEl = document.getElementById("playerCardsInput");
const bigEyeSelectEl = document.getElementById("bigEyeSelect");
const smallRoadSelectEl = document.getElementById("smallRoadSelect");
const cockroachSelectEl = document.getElementById("cockroachSelect");
const runBtnEl = document.getElementById("runPredictionBtn");

// "B P B P" -> ["B","P","B","P"]
function parseBeadRoad(text) {
    if (!text) return [];
    return text
        .split(/\s+/)
        .map(x => x.trim().toUpperCase())
        .filter(x => x === "B" || x === "P" || x === "T");
}

// "4 6 0" -> [4,6,0]
function parseCards(text) {
    if (!text) return [];
    return text
        .split(/\s+/)
        .map(x => Number(x.trim()))
        .filter(v => !isNaN(v));
}

// 組出下三路陣列
function buildDownRoadFromSelects() {
    const big = bigEyeSelectEl?.value || "";
    const small = smallRoadSelectEl?.value || "";
    const cock = cockroachSelectEl?.value || "";

    const downRoad = {
        bigEye: [],
        smallRoad: [],
        cockroach: []
    };

    if (big) downRoad.bigEye.push(big);
    if (small) downRoad.smallRoad.push(small);
    if (cock) downRoad.cockroach.push(cock);

    return downRoad;
}

// 讀取使用者輸入 → 丟進小P → 顯示結果
function runUserPrediction() {
    const beadRoad = parseBeadRoad(beadRoadInputEl?.value || "");
    const bankerCards = parseCards(bankerCardsInputEl?.value || "");
    const playerCards = parseCards(playerCardsInputEl?.value || "");
    const downRoad = buildDownRoadFromSelects();

    if (beadRoad.length === 0) {
        if (logAreaEl) {
            logAreaEl.textContent = "請至少輸入一點珠盤路資料（B / P）。";
        }
        return;
    }

    const result = predictionEngine.predictNext({
        beadRoad,
        bankerCards,
        playerCards,
        downRoad
    });

    if (predictionResultEl) {
        predictionResultEl.textContent =
            `小P 建議：${result.sideText}（信心值：${(result.confidence * 100).toFixed(1)}%）`;
    }

    if (logAreaEl) {
        logAreaEl.textContent =
            `詳細分數：型態=${result.raw.patternScore.toFixed(2)}，` +
            `牌點數=${result.raw.cardScore.toFixed(2)}，` +
            `下三路=${result.raw.downRoadScore.toFixed(2)}，` +
            `總分=${result.raw.totalScore.toFixed(2)}`;
    }

    console.log("Prediction result:", result);
}

document.addEventListener("DOMContentLoaded", () => {
    if (logAreaEl) {
        logAreaEl.textContent = "請輸入珠盤路、牌點數與下三路顏色，然後按「開始預測」。";
    }

    if (runBtnEl) {
        runBtnEl.addEventListener("click", runUserPrediction);
    }
});
