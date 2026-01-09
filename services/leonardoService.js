// services/leonardoService.js - Leonardo AI integration wrapper
import { aiAPI } from '../api/aiAPI';

/**
 * Service for integrating Leonardo AI image generation
 * This wraps the backend API which internally calls the Leonardo AI script
 */
export const leonardoService = {
    /**
     * Generate AI image
     * @param {Object} params
     * @param {string} params.type - 'text_to_image' or 'image_to_image'
     * @param {string} params.prompt - Text prompt
     * @param {string} params.negativePrompt - Optional
     * @param {string} params.inputImage - For image-to-image
     * @param {number} params.width - Default 1024
     * @param {number} params.height - Default 1024
     * @param {string} params.model - Leonardo model
     */
    async generateImage(params) {
        const defaultParams = {
            type: params.type || 'text_to_image',
            prompt: params.prompt,
            negativePrompt: params.negativePrompt || 'blurry, low quality, watermark',
            model: params.model || 'leonardo-diffusion-xl',
            width: params.width || 1024,
            height: params.height || 1024,
            steps: params.steps || 30,
            guidanceScale: params.guidanceScale || 7.5,
        };

        if (params.type === 'image_to_image' && params.inputImage) {
            defaultParams.inputImage = params.inputImage;
        }

        const response = await aiAPI.generateImage(defaultParams);
        return response.data;
    },

    /**
     * Poll for generation completion
     * @param {string} generationId
     * @param {number} maxAttempts - Maximum polling attempts (default 60)
     * @param {number} interval - Polling interval in ms (default 2000)
     */
    async pollGeneration(generationId, maxAttempts = 60, interval = 2000) {
        let attempts = 0;

        while (attempts < maxAttempts) {
            const result = await aiAPI.getGeneration(generationId);

            if (result.data.status === 'completed') {
                return result.data;
            }

            if (result.data.status === 'failed') {
                throw new Error(result.data.errorMessage || 'Generation failed');
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, interval));
            attempts++;
        }

        throw new Error('Generation timeout - please check your history');
    },

    /**
     * Generate and wait for completion
     * @param {Object} params - Generation parameters
     */
    async generateAndWait(params) {
        const generation = await this.generateImage(params);
        const completed = await this.pollGeneration(generation.generationId);
        return completed;
    },

    /**
     * Get coin cost for generation
     * @param {number} width
     * @param {number} height
     * @param {string} type
     */
    calculateCoinsCost(width, height, type = 'text_to_image') {
        const pixels = width * height;

        // Pricing tiers
        if (pixels <= 512 * 512) {
            return type === 'text_to_image' ? 5 : 7;
        } else if (pixels <= 1024 * 1024) {
            return type === 'text_to_image' ? 10 : 12;
        } else {
            return type === 'text_to_image' ? 15 : 18;
        }
    },

    /**
     * Get available models
     */
    getAvailableModels() {
        return [
            {
                id: 'leonardo-diffusion-xl',
                name: 'Leonardo Diffusion XL',
                description: 'High quality general purpose model',
                recommended: true,
            },
            {
                id: 'leonardo-creative',
                name: 'Leonardo Creative',
                description: 'Best for artistic and creative images',
            },
            {
                id: 'leonardo-vision-xl',
                name: 'Leonardo Vision XL',
                description: 'Photorealistic images',
            },
        ];
    },

    /**
     * Validate prompt
     * @param {string} prompt
     */
    validatePrompt(prompt) {
        if (!prompt || prompt.trim().length < 3) {
            return { valid: false, error: 'Prompt must be at least 3 characters' };
        }
        if (prompt.length > 1000) {
            return { valid: false, error: 'Prompt must be less than 1000 characters' };
        }
        return { valid: true };
    },
};
