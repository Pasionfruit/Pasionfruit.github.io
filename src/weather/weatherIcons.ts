import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  type LucideIcon,
  Moon,
  Snowflake,
  Sun,
  Thermometer,
} from 'lucide-react'
import type { WeatherIcon } from './openMeteo'

/** The icon for each weather condition, as named by `describeWeather`. */
export const WEATHER_ICONS: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  snowflake: Snowflake,
  storm: CloudLightning,
  thermometer: Thermometer,
}
