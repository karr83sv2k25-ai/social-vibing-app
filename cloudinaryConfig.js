// Cloudinary config for unsigned uploads
export const cloudinaryConfig = {
  cloudName: "djov7kouf", // Replace with your cloud name
  uploadPreset: "profile_upload", // Replace with your upload preset
  apiKey: "363822471338698", // Replace with your API key
};

// Upload image to Cloudinary
export const uploadImageAsync = async (uri, options = {}) => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    });
    formData.append('upload_preset', options.uploadPreset || cloudinaryConfig.uploadPreset);
    formData.append('cloud_name', cloudinaryConfig.cloudName);
    
    if (options.folder) {
      formData.append('folder', options.folder);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

// Upload audio/video to Cloudinary
export const uploadAudioAsync = async (uri, options = {}) => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'audio/m4a', // or 'audio/mp3', 'audio/wav' depending on format
      name: 'voice.m4a',
    });
    formData.append('upload_preset', options.uploadPreset || cloudinaryConfig.uploadPreset);
    formData.append('cloud_name', cloudinaryConfig.cloudName);
    formData.append('resource_type', 'video'); // Cloudinary uses 'video' for audio files
    
    if (options.folder) {
      formData.append('folder', options.folder);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed:', errorText);
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading audio:', error);
    throw error;
  }
};

// Upload video to Cloudinary
export const uploadVideoAsync = async (uri, options = {}) => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'video/mp4',
      name: 'video.mp4',
    });
    formData.append('upload_preset', options.uploadPreset || cloudinaryConfig.uploadPreset);
    formData.append('cloud_name', cloudinaryConfig.cloudName);
    formData.append('resource_type', 'video');
    
    if (options.folder) {
      formData.append('folder', options.folder);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed:', errorText);
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
};