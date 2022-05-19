const { createInterface } = require("readline");
const { generatePerlinNoise } = require("perlin-noise");
const Jimp = require("jimp");
const { join } = require("path");
const { writeFile, readFile } = require("fs/promises");
const { merge } = require("lodash");

const IO = createInterface({
    input: process.stdin,
    output: process.stdout
});

const CONFIG_PATH = join(__dirname, "config.json");
const STATE_PATH = join(__dirname, "state.json");
const CACHE_PATH = join(__dirname, "cache.json");
const IMAGE_PATH = join(__dirname, "image.png");

let config = null;

function buildPerlinNoise(namespace) {
    let data = {
        method: config.perlin[namespace].method,
        noise: {}
    };

    switch (data.method) {
        case "pn":
            data.noise = generatePerlinNoise(
                config.image.size.width,
                config.image.size.height,
                {
                    octaveCount: config.perlin[namespace].oct || 4,
                    amplitude: config.perlin[namespace].amp || 0.1,
                    persistence: config.perlin[namespace].per || 0.2
                }
            );
            break;
    }

    return data;
}

function getPerlinValue(namespace, x, y) {
    let { method, data } = config.perlin[namespace];
    let { width, height } = config.image.size;

    x += parseFloat(config.image.offset.x);
    y += parseFloat(config.image.offset.y);

    while (x < 0) x += width;
    while (y < 0) y += height;
    while (x > width - 1) x -= width;
    while (y > height - 1) y -= height;

    switch (method) {
        case "pn":
            return data.noise[x + y * width];
    }
}

async function generate() {
    let writeCache = false;
    let { width, height } = config.image.size;

    for (let namespace in config.perlin) {
        if (!config.perlin[namespace].data) {
            writeCache = true;

            config.perlin[namespace].data = buildPerlinNoise(namespace);
        }
    }

    if (writeCache) {
        await writeFile(CACHE_PATH, JSON.stringify(config));
    }

    for (let namespace in config.gates) {
        console.log(namespace);
    }

    new Jimp(width, height, async (error, image) => {
        if (error) return console.log(error);

        let middleX = Math.floor(width / 2);
        let middleY = Math.floor(height / 2);
        let radius2 = Math.pow(width / 2 - 60, 2);
        let size2 = Math.pow(width, 2) + Math.pow(height, 2);

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                let sunCoord =
                    Math.pow(Math.abs(config.image.sun.x - x), 2) +
                    Math.pow(Math.abs(config.image.sun.y - y), 2);

                let middleCoord =
                    Math.pow(Math.abs(middleX - x), 2) +
                    Math.pow(Math.abs(middleY - y), 2);

                if (
                    config.image.size.circular &&
                    !config.image.size.space &&
                    middleCoord > radius2
                ) {
                    continue;
                }

                let { r, g, b, a } = Jimp.intToRGBA(image.getPixelColor(x, y));

                for (let namespace in config.gates) {
                    if (!(namespace in config.perlin)) continue;

                    let value = getPerlinValue(namespace, x, y);

                    config.gates[namespace].some((gate) => {
                        if (gate.check && a === 0) {
                            return false;
                        }

                        if (
                            !("cla" in gate) ||
                            ("cla" in gate && value >= gate.cla)
                        ) {
                            if ("preset" in gate) {
                                switch (gate.preset) {
                                    case "grass":
                                        gate.red = 51;
                                        gate.green = 65;
                                        gate.blue = 16;
                                        break;

                                    case "sand":
                                        gate.red = 239;
                                        gate.green = 197;
                                        gate.blue = 155;
                                        break;

                                    case "water":
                                        gate.red = 70;
                                        gate.green = 88;
                                        gate.blue = 186;
                                        break;
                                }

                                gate.alpha = 255;

                                delete gate.preset;
                            }

                            if ("modify" in gate && gate.modify) {
                                r += gate.red || 0;
                                g += gate.green || 0;
                                b += gate.blue || 0;
                                a += gate.alpha || 0;
                            } else {
                                r = gate.red || 0;
                                g = gate.green || 0;
                                b = gate.blue || 0;
                                a = gate.alpha || 0;
                            }
                            return true;
                        }

                        return false;
                    });
                }

                // apply water to areas without colour
                if (a === 0) {
                    r += 70;
                    g += 88;
                    b += 186;
                    a = 255;
                }

                r -= (sunCoord / size2) * 510;
                g -= (sunCoord / size2) * 510;
                b -= (sunCoord / size2) * 510;

                image.setPixelColor(
                    Jimp.rgbaToInt(
                        Math.min(Math.max(r, 0), 255),
                        Math.min(Math.max(g, 0), 255),
                        Math.min(Math.max(b, 0), 255),
                        Math.min(Math.max(a, 0), 255)
                    ),
                    x,
                    y
                );
            }
        }

        image.dither565();

        if ("circle" in config.image.size && config.image.size.circle) {
            image
                .rotate(14)
                .crop(
                    (image.bitmap.width - width) / 2,
                    (image.bitmap.height - height) / 2,
                    width,
                    height
                );

            if (config.image.size.space) {
                for (let y = 0; y < height; y += 1) {
                    for (let x = 0; x < width; x += 1) {
                        let middleCoord =
                            Math.pow(Math.abs(middleX - x), 2) +
                            Math.pow(Math.abs(middleY - y), 2);

                        if (middleCoord > radius2) {
                            image.setPixelColor(
                                Jimp.rgbaToInt(0, 0, 0, 255),
                                x,
                                y
                            );
                        }
                    }
                }
            }
        }

        await image.writeAsync(IMAGE_PATH);
    });
}

async function start() {
    if (config == null) {
        config = await readFile(CONFIG_PATH);
        config = JSON.parse(config);

        let cache = {};
        try {
            cache = await readFile(CACHE_PATH);
            cache = JSON.parse(cache);
        } catch (_1) {
            cache = {};
        }
        delete cache.gates;

        config = merge(cache, config);
    }

    IO.on("line", async (line) => {
        if (line.trim().length > 0) {
            config = merge(config, JSON.parse(line));

            let clone = JSON.parse(JSON.stringify(config));
            for (let namespace in clone.perlin) {
                delete clone.perlin[namespace].data;
            }

            await writeFile(STATE_PATH, JSON.stringify(clone, null, 4));
        } else {
            for (let namespace in config.perlin) {
                config.perlin[namespace].data = null;
            }
        }

        generate();
    });

    generate();
}

start();
