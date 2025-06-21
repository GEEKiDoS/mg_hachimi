import { Instance } from "cspointscript";

export class HitmarkerController {
    constructor(
        private readonly targetName: string
    ) {}

    started = false;
    requestedStart = false;

    show() {
        this.requestedStart = true;
    }

    onTick() {
        if (this.started) {
            Instance.EntFireAtName(this.targetName, "Stop");
            this.started = false;
            return;
        }

        if (this.requestedStart) {
            this.requestedStart = false;
            Instance.EntFireAtName(this.targetName, "Start");
            this.started = true;
        }
    }
}
