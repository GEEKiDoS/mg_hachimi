const START_POINT = [1920, 736];
    const END_POINT = [576, 320];
    const DELTA = START_POINT.map((v, i) => v - END_POINT[i]);
    const TRACK_LENGTH = Math.sqrt(DELTA[0] * DELTA[0] + DELTA[1] * DELTA[1]);
    const JUDGE_LINE = 128;

    const POOR_RANGE = 0.2;
    const BAD_RANGE = 0.15;
    const GOOD_RANGE = 0.1;
    const GREAT_RANGE = 0.05;
    const PGREAT_RANGE = 0.02;

    const JUDGE_TO_TEXT = ['PERFECT', 'GREAT', 'GOOD', 'BAD', 'POOR', 'UNKNOWN'];
    const LOC_TO_TEXT = ['HEAD', 'BODY'];

    const WAIT_TIME = 0.25;

export const C = {
    END_POINT, DELTA, TRACK_LENGTH, JUDGE_LINE,
    POOR_RANGE, BAD_RANGE, GOOD_RANGE, GREAT_RANGE, PGREAT_RANGE,
    JUDGE_TO_TEXT, LOC_TO_TEXT, WAIT_TIME
};
