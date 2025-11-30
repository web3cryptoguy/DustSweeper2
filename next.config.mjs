import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Fix for @react-native-async-storage/async-storage module resolution
      const emptyModulePath = resolve(__dirname, './lib/empty-module.js');
      
      // Set alias first
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': emptyModulePath,
      };
      
      // Set fallback
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
      };
      
      // Use IgnorePlugin to completely ignore the module
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^@react-native-async-storage\/async-storage$/,
        })
      );
      
      // Also use NormalModuleReplacementPlugin as a fallback
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /@react-native-async-storage\/async-storage/,
          emptyModulePath
        )
      );
    }
    
    // Fix for Next.js tracer issue - ignore OpenTelemetry API
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@opentelemetry\/api$/,
      })
    );
    
    return config;
  },
}

export default nextConfig
