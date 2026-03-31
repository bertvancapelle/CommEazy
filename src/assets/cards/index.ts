/**
 * Card image lookup — maps Solitaire engine Suit+Rank to PNG images.
 *
 * Source: notpeter/Vector-Playing-Cards (Public Domain / WTFPL)
 * PNG rendered at 225×315px (@3x of 75×105pt)
 */

import type { Suit, Rank } from '@/engines/solitaire/engine';
import type { ImageSourcePropType } from 'react-native';

// React Native requires static require() calls — no dynamic path construction.
// This map covers all 52 cards (4 suits × 13 ranks).

const CARD_IMAGES: Record<Suit, Record<Rank, ImageSourcePropType>> = {
  clubs: {
    1: require('./AC.png'),
    2: require('./2C.png'),
    3: require('./3C.png'),
    4: require('./4C.png'),
    5: require('./5C.png'),
    6: require('./6C.png'),
    7: require('./7C.png'),
    8: require('./8C.png'),
    9: require('./9C.png'),
    10: require('./10C.png'),
    11: require('./JC.png'),
    12: require('./QC.png'),
    13: require('./KC.png'),
  },
  diamonds: {
    1: require('./AD.png'),
    2: require('./2D.png'),
    3: require('./3D.png'),
    4: require('./4D.png'),
    5: require('./5D.png'),
    6: require('./6D.png'),
    7: require('./7D.png'),
    8: require('./8D.png'),
    9: require('./9D.png'),
    10: require('./10D.png'),
    11: require('./JD.png'),
    12: require('./QD.png'),
    13: require('./KD.png'),
  },
  hearts: {
    1: require('./AH.png'),
    2: require('./2H.png'),
    3: require('./3H.png'),
    4: require('./4H.png'),
    5: require('./5H.png'),
    6: require('./6H.png'),
    7: require('./7H.png'),
    8: require('./8H.png'),
    9: require('./9H.png'),
    10: require('./10H.png'),
    11: require('./JH.png'),
    12: require('./QH.png'),
    13: require('./KH.png'),
  },
  spades: {
    1: require('./AS.png'),
    2: require('./2S.png'),
    3: require('./3S.png'),
    4: require('./4S.png'),
    5: require('./5S.png'),
    6: require('./6S.png'),
    7: require('./7S.png'),
    8: require('./8S.png'),
    9: require('./9S.png'),
    10: require('./10S.png'),
    11: require('./JS.png'),
    12: require('./QS.png'),
    13: require('./KS.png'),
  },
};

export function getCardImage(suit: Suit, rank: Rank): ImageSourcePropType {
  return CARD_IMAGES[suit][rank];
}
