// ===== trainer-cards.js — колода, руки и рендер карт на столе тренажёра =====
// Генерирует 52 карты, извлекает «участвующие» руки из participation-матрицы
// узла тренажёра, выбирает случайную и рендерит пару карт на позиции HERO.
// Генерация раздачи (generateDeal) отделена от рендера (renderCards):
// раздача возвращает руку С координатами ячейки (row/col) — по ним движок
// определяет верный ответ по броску ГСЧ (см. trainer-engine.getCorrectAnswer).
//
// Матрица participation (13×13): строки/столбцы = A,K,Q,J,T,9,8,7,6,5,4,3,2.
//   r == c  → пара   (AA, KK, …)
//   r < c   → suited (AKs, AQs, …)
//   r > c   → offsuit(AKo, AQo, …)

var RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
var SUITS = ['s', 'h', 'd', 'c'];

var SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
var SUIT_CLASS  = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };

// Масти/символы — общий маппинг (мини-карты истории в trainer-stats.js).
export { SUIT_SYMBOL, SUIT_CLASS };

// ===== ПОЛНАЯ КОЛОДА (52 карты) =====
function buildDeck() {
    var deck = [];
    for (var si = 0; si < SUITS.length; si++) {
        for (var ri = 0; ri < RANKS.length; ri++) {
            deck.push({ rank: RANKS[ri], suit: SUITS[si] });
        }
    }
    return deck;
}

// Тасование Фишера — Йейтса
function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
}

// ===== ИЗВЛЕЧЕНИЕ УЧАСТВУЮЩИХ РУК ИЗ МАТРИЦЫ =====
function getParticipatingHands(participation, disabled) {
    var hands = [];
    for (var r = 0; r < 13; r++) {
        for (var c = 0; c < 13; c++) {
            if (disabled && disabled[r] && disabled[r][c]) continue;
            if (!participation || !participation[r] || !participation[r][c]) continue;

            if (r === c) {
                hands.push({ rank1: RANKS[r], rank2: RANKS[c], type: 'pair', row: r, col: c });
            } else if (r < c) {
                // Старший ранг первым (row — старший)
                hands.push({ rank1: RANKS[r], rank2: RANKS[c], type: 'suited', row: r, col: c });
            } else {
                // Offsuit: c < r, значит RANKS[c] старше — он первым
                hands.push({ rank1: RANKS[c], rank2: RANKS[r], type: 'offsuit', row: r, col: c });
            }
        }
    }
    return hands;
}

// ===== ГЕНЕРАЦИЯ ПАРЫ КАРТ ДЛЯ РУКИ =====
function handToCards(hand) {
    var deck = shuffle(buildDeck());

    if (hand.type === 'pair') {
        // Пара: две карты одного номинала, разные масти
        var c1 = null, c2 = null;
        for (var i = 0; i < deck.length; i++) {
            if (deck[i].rank === hand.rank1) {
                if (!c1) c1 = deck[i];
                else { c2 = deck[i]; break; }
            }
        }
        return c1 && c2 ? [c1, c2] : null;
    }

    if (hand.type === 'suited') {
        // Одномастные: одна масть для обеих карт
        var suit = SUITS[Math.floor(Math.random() * 4)];
        return [
            { rank: hand.rank1, suit: suit },
            { rank: hand.rank2, suit: suit }
        ];
    }

    // Разномастные: разные масти (в колоде 4 РАЗНЫЕ масти — дубль невозможен)
    var suits = shuffle(SUITS.slice());
    return [
        { rank: hand.rank1, suit: suits[0] },
        { rank: hand.rank2, suit: suits[1] }
    ];
}

// ===== РАЗДАЧА =====
// Случайная участвующая рука + её карты + координаты ячейки (row/col).
// null — участвующих рук нет (пустой participation).
export function generateDeal(participation, disabled) {
    var hands = getParticipatingHands(participation, disabled);
    if (hands.length === 0) return null;

    var hand = hands[Math.floor(Math.random() * hands.length)];
    var cards = handToCards(hand);
    if (!cards) return null;

    return {
        rank1: hand.rank1,
        rank2: hand.rank2,
        type: hand.type,
        row: hand.row,
        col: hand.col,
        cards: cards
    };
}

// ===== РЕНДЕР ПАРЫ КАРТ (DOM) =====
export function renderCards(container, cards) {
    container.innerHTML = '';
    if (!cards || cards.length === 0) return;

    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var cardDiv = document.createElement('div');
        cardDiv.className = 'trainer-card ' + SUIT_CLASS[card.suit];

        var badge = document.createElement('div');
        badge.className = 'trainer-card-suit';
        badge.textContent = SUIT_SYMBOL[card.suit];

        var rankDiv = document.createElement('div');
        rankDiv.className = 'trainer-card-rank';
        rankDiv.textContent = card.rank;

        cardDiv.appendChild(badge);
        cardDiv.appendChild(rankDiv);
        container.appendChild(cardDiv);
    }
}