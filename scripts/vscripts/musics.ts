export interface Chart {
    NoteDataList: {
        Time: number;
        LaneId: number;
    }[];
    BarLineList: number[];
}

export interface Music {
    name: string,
    charter: string,
    sndEvent: string,
    monitorBodygroup: number,
    chart: Chart,
    sort: number,
}

export const charts: Music[] = [];
