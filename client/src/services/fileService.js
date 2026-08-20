import api from './api';

export const uploadFile = (file, token) => {
  const formData = new FormData();
  formData.append('file', file);

  return api.post('/files/upload', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const listFiles = (token) => {
  return api.get('/files', {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const deleteFile = (fileId, token) => {
  return api.delete(`/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const getDownloadUrl = (fileId) => {
  return `${api.defaults.baseURL}/files/${fileId}/download`;
};