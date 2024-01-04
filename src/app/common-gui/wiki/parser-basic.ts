// Basic parser export functions for wiki syntax
import { Detector, ConsumptionResult, SimpleDetector, SpecialCharDetector, WhitespaceDetector } from "./parser-detectors";

export class ConsumptionError extends Error { }

// Basic parsers
export function consume<T=any>(queue: string[], ...detectors: Detector[]): ConsumptionResult<T> {
    // Consume next if detected
    for (let detector of detectors) {
        let { detected, buffer, extra } = detector(
            queue.slice()
        );

        if (detected) {
            if (buffer !== undefined) {
                queue.splice(0, buffer.length);
            }

            return {
                trigger: buffer,
                buffer: buffer ?? '',
                extra: extra as T
            };
        }
    }

    throw new ConsumptionError(`No detector detected: ${queue.slice(0, 10).join('')}`);
}

export function consumeWhileWithResults<T>(queue: string[], ...detectors: Detector[]): ConsumptionResult<T>[] {
    let results: ConsumptionResult<T>[] = [];

    while (queue.length > 0) {
        let result = consume<T>(
            queue,
            ...detectors,
        );

        results.push(result);
    }

    return results;
}

export function consumeUntil(queue: string[], ...detectors: Detector[]): ConsumptionResult<any> {
    let result: string = '';

    while (queue.length > 0) {
        for (let detector of detectors) {
            let { detected, buffer, extra } = detector(
                queue.slice()
            );

            if (detected) {
                return {
                    trigger: buffer,
                    buffer: result,
                    extra,
                };
            }
        }

        result += queue.shift();
    }

    return {
        buffer: result,
    };
}

export function consumeUntilReverse(queue: string[], ...detectors: Detector[]): ConsumptionResult<any> {
    // Consume from the back
    let result: string = '';

    while (queue.length > 0) {
        for (let detector of detectors) {
            let { detected, buffer, extra } = detector(
                queue.slice().reverse()
            );

            if (detected) {
                return {
                    trigger: buffer,
                    buffer: result,
                    extra,
                };
            }
        }

        result += queue.pop();
    }

    return {
        buffer: result,
    };
}

export function consumeWhile(queue: string[], ...detectors: Detector[]): ConsumptionResult<any[]> {
    let result: string = '';
    let extras: any[] = [];

    while (queue.length > 0) {
        for (let detector of detectors) {
            let { detected, buffer, extra } = detector(
                queue.slice()
            );

            if (!detected || buffer === undefined) {
                return {
                    buffer: result,
                    trigger: result,
                    extra: extras,
                };
            }

            result += buffer;

            queue.splice(0, buffer.length);

            if (extra !== undefined) {
                extras.push(extra);
            }
        }
    }

    return {
        buffer: result,
        trigger: result,
        extra: extras,
    };
}

export function comsumeWhileReverse(queue: string[], ...detectors: Detector[]): ConsumptionResult<any[]> {
    // Consume from the back
    let result: string = '';
    let extras: any[] = [];

    while (queue.length > 0) {
        let detected: boolean = false;

        for (let detector of detectors) {
            let { detected, buffer, extra } = detector(
                queue.slice().reverse()
            );

            if (detected) {
                result += buffer;

                if (buffer !== undefined) {
                    queue.splice(queue.length - buffer.length, buffer.length);
                }

                if (extra !== undefined) {
                    extras.push(extra);
                }

                break;
            }
        }

        if (!detected) {
            break;
        }
    }

    return {
        buffer: result,
        extra: extras,
    };
}


export function consumePlain(queue: string[]): ConsumptionResult {
    // Consume until next special char
    return consumeUntil(
        queue,
        SpecialCharDetector
    );
}

export function trimStart(queue: string[], ...detectors: Detector[]): string {
    // Consume while detected
    let { buffer } = consumeWhile(
        queue,
        ...detectors,
    );

    return buffer;
}

export function trimEnd(queue: string[], ...detectors: Detector[]): string {
    // Consume while detected
    let { buffer } = comsumeWhileReverse(
        queue,
        ...detectors,
    );

    return buffer;
}

export function trim(queue: string[], ...detectors: Detector[]): { start: string, end: string } {
    // If no detectors are given, consume whitespace and newlines
    if (detectors.length === 0) {
        detectors = [
            WhitespaceDetector,
        ];
    }

    let start: string = trimStart(
        queue,
        ...detectors,
    );

    let end: string = trimEnd(
        queue,
        ...detectors,
    );

    return {
        start,
        end,
    };
}