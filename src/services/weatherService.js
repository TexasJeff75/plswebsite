const WEATHER_CACHE = new Map();
const CACHE_DURATION = 30 * 60 * 1000;

function getWeatherIcon(weatherCode) {
  if (weatherCode === 0) return { emoji: '☀️', text: 'Clear' };
  if (weatherCode <= 3) return { emoji: '⛅', text: 'Partly Cloudy' };
  if (weatherCode <= 48) return { emoji: '🌫️', text: 'Foggy' };
  if (weatherCode <= 59) return { emoji: '🌦️', text: 'Drizzle' };
  if (weatherCode <= 69) return { emoji: '🌧️', text: 'Rain' };
  if (weatherCode <= 79) return { emoji: '❄️', text: 'Snow' };
  if (weatherCode <= 84) return { emoji: '🌧️', text: 'Showers' };
  if (weatherCode <= 99) return { emoji: '⛈️', text: 'Thunderstorm' };
  return { emoji: '🌤️', text: 'Unknown' };
}

function getWindDirection(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

export const weatherService = {
  async getWeatherForLocation(latitude, longitude) {
    const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const cached = WEATHER_CACHE.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
      );

      if (!response.ok) {
        throw new Error('Weather API request failed');
      }

      const data = await response.json();

      const weatherData = {
        temperature: Math.round(data.current.temperature_2m),
        feelsLike: Math.round(data.current.apparent_temperature),
        humidity: data.current.relative_humidity_2m,
        windSpeed: Math.round(data.current.wind_speed_10m),
        windDirection: getWindDirection(data.current.wind_direction_10m),
        weatherCode: data.current.weather_code,
        icon: getWeatherIcon(data.current.weather_code),
        timestamp: new Date(data.current.time)
      };

      WEATHER_CACHE.set(cacheKey, {
        data: weatherData,
        timestamp: Date.now()
      });

      return weatherData;
    } catch (error) {
      console.error('Error fetching weather:', error);
      return null;
    }
  },

  async getWeatherForFacilities(facilities) {
    const weatherPromises = facilities
      .filter(f => f.latitude && f.longitude)
      .map(async facility => {
        const weather = await this.getWeatherForLocation(
          parseFloat(facility.latitude),
          parseFloat(facility.longitude)
        );
        return {
          facilityId: facility.id,
          weather
        };
      });

    const results = await Promise.all(weatherPromises);

    const weatherMap = {};
    results.forEach(result => {
      weatherMap[result.facilityId] = result.weather;
    });

    return weatherMap;
  },

  clearCache() {
    WEATHER_CACHE.clear();
  }
};
