import apiClient from "@api/config/apiConfig";

export const getData = async (endpoint, params = {}) => {
  try {
    const response = await apiClient.get(endpoint, { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const postData = async (endpoint, data = {}) => {
  try {
    const response = await apiClient.post(endpoint, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const putData = async (endpoint, data = {}) => {
  try {
    const response = await apiClient.put(endpoint, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteData = async (endpoint) => {
  try {
    const response = await apiClient.delete(endpoint);
    return response.data;
  } catch (error) {
    throw error;
  }
};
