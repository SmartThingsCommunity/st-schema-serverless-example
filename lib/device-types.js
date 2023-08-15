module.exports = {
  "c2c-switch": {
    "name": "Switch",
    "states": {
      "online": true,
      "switch": "off"
    }
  },
  "c2c-dimmer": {
    "name": "Dimmer",
    "states": {
      "online": true,
      "switch": "off",
      "brightness": 100
    }
  },
  "c2c-color-temperature-bulb": {
    "name": "Tunable White Bulb",
    "states": {
      "online": true,
      "switch": "off",
      "brightness": 100,
      "colorTemperature": 3000
    }
  },
  "c2c-motion-2": {
    "name": "Motion Sensor",
    "states": {
      "online": true,
      "motion": "inactive",
      "battery": 100
    }
  },
  "c2c-motion": {
    "name": "Motion & Temperature",
    "states": {
      "online": true,
      "motion": "inactive",
      "temperature": 78,
      "temperatureScale": "F",
      "battery": 100,
    }
  },
  "c2c-contact-3": {
    "name": "Open/Close Sensor",
    "states": {
      "online": true,
      "contact": "closed",
      "battery": 100
    }
  },
  "c2c-rgb-color-bulb": {
    "name": "Color Bulb",
    "states": {
      "online": true,
      "switch": "off",
      "brightness": 100,
      "hue": 0,
      "saturation": 0
    }
  },
  "c2c-rgbw-color-bulb": {
    "name": "Color & Tunable White Bulb ",
    "states": {
      "online": true,
      "switch": "off",
      "brightness": 100,
      "colorTemperature": 3000,
      "hue": 0,
      "saturation": 0
    }
  }
};
