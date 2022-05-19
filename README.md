# WorldGen

Implementation of perlin noise to produce world map generation.

Initial proof of concept before being implemented into an interactive app.

## Config

In the `config.json` file the user can specify the world generation parameters.

The config file has three keys "image", "perlin", and "gates".

### Image

`"image"` contains what the image should look like, regardless of random elements

```json
{
    "image": {
        "size": {
            "width": 1024, // width of the final image (pixels)
            "height": 1024, // height of the final image (pixels)
            "circle": true, // whether the final image should be circular
            "space": true // whether the final image should have a background
        },
        "sun": {
            "x": 0, // x position to center lighting
            "y": 0 // y position to center lighting
        },
        "offset": {
            "x": 0, // x position to offset final image by
            "y": 0 // y position to offset final image by
        }
    }
}
```

### Perlin

`"perlin"` contains how each perlin noise generation should be calculated

Each `"name"` is unique and specified by the user to identify the specific data.

```json
{
    "perlin": {
        "name": {
            "method": "pn", // "pn" is the only method currently implemented
            "oct": 8, // octaveCount used by perlin-noise npm package
            "amp": 0.1, // amplitude used by perlin-noise npm package (doesn't seem to do anything)
            "per": 0.5 // persistence used by perlin-noise npm package
        }
    }
}
```

### Gates

`"gates"` contains which colours should be affected by perlin noise values

Each `"name"` should match that of a given `"perlin"` name above.

```json
{
    "gates": {
        "name": [
            {
                "cla": 0.5, // if a given noise value is over this value, the colours are used
                "modify": true, // if true, the pixel is changed by these values - rather than set to them
                "check": true, // if true, the existing pixel must have an alpha value prior to being overwritten/modified
                "preset": "grass", // to use built-in preset colours
                "red": 255, // red value to apply/modify by
                "green": 0, // green value to apply/modify by
                "blue": 0, // blue value to apply/modify by
                "alpha": 255 // alpha value to apply/modify by
            }
        ]
    }
}
```

The above config would, for example:

1. Prepare for an image of 1024 x 1024 (`image.size.width` / `image.size.height`)
2. Generate random noise (using `perlin-noise` npm package, octaveCount 8, amplitude 0.1, persistence 0.5) for the prepared image - stored as "name"
3. Loop through every pixel of the image and find the value for the pixel in the random "name" data, if it is above 0.5 we modify an existing pixel by the preset value of "grass" (if it exists), otherwise red +255, green +0, blue +0, alpha +255
4. Dither the image, making it look slightly nicer
5. Rotate the image by 14 degrees (making it look more like a planet)
6. Crop the image to remove the excess that rotating added
7. Trim the image to just a circle
8. Replace any transparent pixels with black background

## Usage

Clone the repository, run `npm install`, then `node .`

This will use the existing `config.json` file in the repository.

This will produce an "image.png" in the root with the newly created image.

If you want to modify the image you can either:

### Live Editing

Once the program is run, the terminal will listen for input.

You can type an object that will be merged with your config.

For example, when the program is running you can type:

```
{ "image": { "sun": { "x": 200 } } }
```

This would change the `config.image.sun.x` property to 200 and re-render.

Hitting enter without typing will re-build perlin noise and re-render.

### File Editing

If you make any "live" changes using the above method, a `state.json` file is output, this will store your live changes.

In addition a `cache.json` file is produced to store the current data of the random generator, allowing you to quit the program and re-launch it - without changing _what_ is being generated.

Instead of live editing, you can make permanent changes by quitting the application and modifying the `config.json` file and re-running `node .`
