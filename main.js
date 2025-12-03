// ========================================
// 小P 百家樂預測系統 - Web 版 PredictionEngine
// 說明：這是「架構版」，包含三種預測邏輯：
// 1. 牌路型態（大路）
// 2. 牌點數與牌型
// 3. 下三路顏色共識
// 之後可以把 Swift 的邏輯一條條搬進來。
// ========================================

// 預測引擎主體
class PredictionEngine {
    constructor() {
        // 權重可以之後依照實戰微調
        this.weights = {
            pattern: 0.4,     // 型態預測
            cardPoints: 0.3,  // 牌點數 / 牌型
            downRoad: 0.3     // 下三路顏色共識
        };
    }

    /**
     * 主預測函式
     * input 範例：
     * {
     *   beadRoad: ['B', 'P', 'B', ...],    // 珠盤路（結果序列）
     *   bankerCards: [4, 6, 0],            // 莊家三張牌點數（0~9，10/J/Q/K 請轉成 0）
     *   playerCards: [9, 1],               // 閒家牌點數
     *   downRoad: {                        // 下三路顏色狀態（之後可接大眼、小路、曱甴路）
     *     bigEye: ['R', 'B', 'R', ...],
     *     smallRoad: ['R', 'R', 'B', ...],
     *     cockroach: ['R', 'B', 'B', ...]
     *   }
     * }
     */
    predictNext(input) {
        const {
            beadRoad = [],
            bankerCards = [],
            playerCards = [],
            downRoad = {}
        } = input || {};

        // 1. 型態預測（大路）
        const patternScore = this._evaluatePattern(beadRoad);

        // 2. 牌點數 / 牌型預測
        const cardScore = this._evaluateCardPoints(bankerCards, playerCards);

        // 3. 下三路顏色共識
        const downRoadScore = this._evaluateDownRoad(downRoad);

        // ----------------------------------------
        // 綜合加權
        // >0 傾向莊，<0 傾向閒，接近 0 就低信心
        // ----------------------------------------
        const totalScore =
            patternScore * this.weights.pattern +
            cardScore * this.weights.cardPoints +
            downRoadScore * this.weights.downRoad;

        // 轉成預測結果（莊 / 閒 / 和）
        const result = this._scoreToDecision(totalScore);

        // 信心值：以絕對值計算，0~1 之間
        const confidence = Math.min(1, Math.abs(totalScore));

        return {
            side: result.side,                 // 'BANKER' | 'PLAYER' | 'TIE'
            sideText: result.sideText,         // '莊' / '閒' / '和'
            confidence: confidence,            // 0.0 ~ 1.0
            raw: {
                patternScore,
                cardScore,
                downRoadScore,
                totalScore
            }
        };
    }

    // ==============================
    // 1. 型態預測（大路結構）
    // ==============================
    _evaluatePattern(beadRoad) {
        if (!beadRoad || beadRoad.length === 0) return 0;

        // B = 莊, P = 閒
        const last = beadRoad[beadRoad.length - 1];
        const recent = beadRoad.slice(-10); // 看最近 10 局

        const bankerCount = recent.filter(r => r === 'B').length;
        const playerCount = recent.filter(r => r === 'P').length;

        // 簡單示範：莊多 → 偏向莊；閒多 → 偏向閒
        let bias = 0;
        if (bankerCount + playerCount > 0) {
            bias = (bankerCount - playerCount) / (bankerCount + playerCount);
        }

        // 另外考慮最後一局是誰
        const lastBonus = last === 'B' ? 0.1 : last === 'P' ? -0.1 : 0;

        const score = bias + lastBonus;

        // 分數範圍大概在 -1 ~ 1，後續可以在這裡加入你的 31 種型態判斷
        return score;
    }

    // ==============================
    // 2. 牌點數 / 牌型預測
    // ==============================
    _evaluateCardPoints(bankerCards, playerCards) {
        if (!Array.isArray(bankerCards) || !Array.isArray(playerCards)) {
            return 0;
        }

        const bankerTotal = this._baccaratPointSum(bankerCards);
        const playerTotal = this._baccaratPointSum(playerCards);

        // 簡單版：牌面高 → 下次偏向轉邊 or 延續
        // 這裡先做「高一方下次不利」的概念示範，之後你可以照 Swift 邏輯重寫
        const diff = bankerTotal - playerTotal;

        // diff > 0 代表莊比較高 → 下一局略偏向閒（-0.3）
        // diff < 0 代表閒比較高 → 下一局略偏向莊（+0.3）
        if (diff > 0) {
            return -0.3;
        } else if (diff < 0) {
            return 0.3;
        } else {
            return 0; // 平點數就中立
        }
    }

    // 計算百家樂點數（10/J/Q/K 轉成 0）
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

    // ==============================
    // 3. 下三路顏色共識
    // ==============================
    _evaluateDownRoad(downRoad) {
        const { bigEye = [], smallRoad = [], cockroach = [] } = downRoad || {};

        const lastBig = bigEye[bigEye.length - 1];
        const lastSmall = smallRoad[smallRoad.length - 1];
        const lastCockroach = cockroach[cockroach.length - 1];

        // R = 紅(莊有利), B = 藍(閒有利)
        let score = 0;

        const toScore = (color) => {
            if (color === 'R') return 0.5;   // 紅偏莊
            if (color === 'B') return -0.5;  // 藍偏閒
            return 0;
        };

        score += toScore(lastBig);
        score += toScore(lastSmall);
        score += toScore(lastCockroach);

        // 三路同色時分數會接近 ±1.5
        // 這裡可以之後再加入你的「三路共識、變色警訊、轉折觸發」等實戰邏輯
        return score / 1.5; // 正規化到大約 -1 ~ 1
    }

    // ==============================
    // 分數轉成實際下注建議
    // ==============================
    _scoreToDecision(totalScore) {
        // 這裡先簡化：接近 0 當成低信心的莊/閒，不特別猜和
        if (totalScore > 0.05) {
            return { side: 'BANKER', sideText: '莊' };
        } else if (totalScore < -0.05) {
            return { side: 'PLAYER', sideText: '閒' };
        } else {
            // 如果你想特別處理「和局」預測，也可以在這裡塞邏輯
            return { side: 'PLAYER', sideText: '閒' }; // 預設偏向閒
        }
    }
}

// ==========================================================
// 以下是與畫面連動的程式碼（之後可以改成接按鈕與輸入區）
// ==========================================================

// 全域預測引擎實例
const predictionEngine = new PredictionEngine();

// 取得畫面元素
const predictionResultEl = document.getElementById("predictionResult");
const logAreaEl = document.getElementById("logArea");

/**
 * Demo：先用一組假資料做預測
 * 之後會改成接你實際輸入的：莊/閒/和紀錄與牌面
 */
function runDemoPrediction() {
    const demoInput = {
        beadRoad: ['B', 'P', 'B', 'B', 'P', 'B', 'B', 'P', 'B', 'B'],
        bankerCards: [4, 6],   // 例如上一局莊 4 + 6
        playerCards: [9, 1],   // 例如上一局閒 9 + 1
        downRoad: {
            bigEye: ['R', 'R', 'R', 'R'],
            smallRoad: ['R', 'R', 'B'],
            cockroach: ['R', 'R', 'R']
        }
    };

    const result = predictionEngine.predictNext(demoInput);

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

// 頁面載入完成後自動跑一次 demo
document.addEventListener("DOMContentLoaded", () => {
    if (logAreaEl) {
        logAreaEl.textContent = "系統已啟動，正在使用 Demo 資料進行預測...";
    }
    runDemoPrediction();
});
