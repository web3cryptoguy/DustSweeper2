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
    // Fix for @react-native-async-storage/async-storage module resolution
    const emptyModulePath = resolve(__dirname, './lib/empty-module.js');
    
    // CRITICAL: Add IgnorePlugin FIRST, before any other processing
    // This must be applied to both client and server builds
    const asyncStorageIgnorePlugin = new webpack.IgnorePlugin({
      resourceRegExp: /^@react-native-async-storage\/async-storage$/,
      contextRegExp: /node_modules\/@metamask\/sdk/,
    });
    
    // Add to plugins array at the beginning to ensure it's processed first
    config.plugins.unshift(asyncStorageIgnorePlugin);
    
    // Also add a general IgnorePlugin without context restriction
    config.plugins.unshift(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@react-native-async-storage\/async-storage$/,
      })
    );
    
    if (!isServer) {
      // Set alias with absolute path (client-side)
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': emptyModulePath,
      };
      
      // Set fallback (client-side)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
      };
      
      // Use NormalModuleReplacementPlugin as a fallback (client-side only)
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
