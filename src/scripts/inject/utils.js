window.BT_UTILS = (function () {
    'use strict';

    const has = Object.prototype.hasOwnProperty;

    function flattenRuns(arr) {
        if (arr.simpleText !== undefined) return arr.simpleText;
        if (!(arr.runs instanceof Array)) return arr;
        return arr.runs.reduce((res, v) => {
            if (has.call(v, 'text')) {
                res.push(v.text);
            }
            return res;
        }, []).join(' ');
    }

    function getObjectByPath(obj, path, def = undefined) {
        const paths = (path instanceof Array) ? path : path.split('.');
        let nextObj = obj;

        const exist = paths.every((v) => {
            // support bracket/index notation like "metadataRows[1]"
            if (/\[.*\]/.test(v)) {
                // split base name and all numeric indices like "a[1][2]"
                const parts = [];
                const baseMatch = v.match(/^([^\[]+)/);
                if (baseMatch && baseMatch[1]) parts.push(baseMatch[1]);
                const idxMatches = [...v.matchAll(/\[(\d+)\]/g)].map(m => parseInt(m[1], 10));

                // navigate to base property first (if present)
                for (let p = 0; p < parts.length; p += 1) {
                    const key = parts[p];
                    if (!nextObj || !has.call(nextObj, key)) return false;
                    nextObj = nextObj[key];
                }

                // then apply numeric indices in order
                for (let k = 0; k < idxMatches.length; k += 1) {
                    const idx = idxMatches[k];
                    if (!Array.isArray(nextObj) || idx < 0 || idx >= nextObj.length) return false;
                    nextObj = nextObj[idx];
                }

                return true;
            }

            // segment is a plain token (no bracket)
            if (nextObj instanceof Array) {
                // when we have an array of objects, find an element that contains the key v
                const found = nextObj.find(o => has.call(o, v));
                if (found === undefined) return false;
                nextObj = found[v];
            } else {
                if (!nextObj || !has.call(nextObj, v)) return false;
                nextObj = nextObj[v];
            }
            return true;
        });

        return exist ? nextObj : def;
    }

    function getFlattenByPath(obj, filterPath) {
        if (filterPath === undefined) return;
        const filterPathArr = filterPath instanceof Array ? filterPath : [filterPath];
        let value;
        for (let idx = 0; idx < filterPathArr.length; idx += 1) {
            value = getObjectByPath(obj, filterPathArr[idx]);
            if (value !== undefined) return flattenRuns(value);
        }
    }

    function postMessage(type, data) {
        window.postMessage({ from: 'BLOCKTUBE_PAGE', type, data }, document.location.origin);
    }

    function parseTime(timeStr) {
        if (timeStr === 'SHORTS') {
            return -2;
        }
        const parts = String(timeStr).split(':').map(x => parseInt(x, 10));
        switch (parts.length) {
            case 3: {
                return (parts[0] * 60 * 60) + (parts[1] * 60) + parts[2];
            }
            case 2: {
                return (parts[0] * 60) + parts[1];
            }
            case 1: {
                return parts[0];
            }
            default: {
                return -1;
            }
        }
    }

    function parseViewCount(viewCount) {
        const parts = viewCount.split(" ");
        if (parts[1] !== "views" && parts[1] !== "view") return undefined; // Fail if not english formatting
        let views = parts[0];

        // Handle abbreviated formats (K, M, B)
        const multipliers = {
            'K': 1000,
            'M': 1000000,
            'B': 1000000000
        };

        // Check if it ends with a multiplier
        const lastChar = views.slice(-1).toUpperCase();
        let multiplier = 1;
        let numericPart = views.replace(',', '');

        if (multipliers[lastChar]) {
            multiplier = multipliers[lastChar];
            numericPart = views.slice(0, -1); // Remove the letter
        }

        // Return the final count
        return (numericPart * multiplier);
    }

    function deepClone(obj) {
        // Simple deep clone (for plain objects, no functions/cycles)
        return JSON.parse(JSON.stringify(obj));
    }

    return {
        getFlattenByPath,
        getObjectByPath,
        postMessage,
        parseTime,
        parseViewCount,
        deepClone,
    };
}());