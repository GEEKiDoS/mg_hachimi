const START_POINT = [1920, 736];
const END_POINT = [576, 320];
const DELTA = START_POINT.map((v, i) => v - END_POINT[i]);
const TRACK_LENGTH = Math.sqrt(DELTA[0] * DELTA[0] + DELTA[1] * DELTA[1]);
const JUDGE_LINE = 128;

// const POOR_RANGE = 0.2;
// const BAD_RANGE = 0.1166;
// const GOOD_RANGE = 0.0833;
// const GREAT_RANGE = 0.0667;
// const PGREAT_RANGE = 0.0333;

const JUDGE_RANGE_SETS = [{
    POOR: 0.2,
    BAD: 0.1166,
    GOOD: 0.0833,
    GREAT: 0.0667,
    PGREAT: 0.0333,
}, {
    POOR: 0.2,
    BAD: 0.17,
    GOOD: 0.0833 * 2,
    GREAT: 0.0667 * 2,
    PGREAT: 0.0333 * 2,
}];

const JUDGE_TO_TEXT = ['PERFECT', 'GREAT', 'GOOD', 'BAD', 'POOR', 'UNKNOWN'];
const LOC_TO_TEXT = ['HEAD', 'BODY'];
const OPTION_TO_TEXT = [undefined, 'MIRROR', 'RANDOM', 'R-RANDOM', 'S-RANDOM'];
const JUDGE_OPTION_TO_TEXT = [undefined, 'EASY'];

const WAIT_TIME = 0.25;

const RATE_PRECENTS = [
    { percent: 0.8889, rate: 'AAA' },
    { percent: 0.7778, rate: 'AA' },
    { percent: 0.6667, rate: 'A' },
    { percent: 0.5556, rate: 'B' },
    { percent: 0.4444, rate: 'C' },
    { percent: 0.3333, rate: 'D' },
    { percent: 0.2222, rate: 'E' },
    { percent: -1, rate: 'F' },
];

export const C = {
    END_POINT, DELTA, TRACK_LENGTH, JUDGE_LINE,
    // POOR_RANGE, BAD_RANGE, GOOD_RANGE, GREAT_RANGE, PGREAT_RANGE,
    JUDGE_RANGE_SETS,
    LOC_TO_TEXT, WAIT_TIME, RATE_PRECENTS, 
    JUDGE_TO_TEXT, OPTION_TO_TEXT, JUDGE_OPTION_TO_TEXT
};

export enum Opt {
    Off = 0,
    Mirror = 1,
    Random = 2,
    R_Random = 3,
    S_Random = 4,
}

export enum JudgeOpt {
    Normal = 0,
    Easy = 1,
}
