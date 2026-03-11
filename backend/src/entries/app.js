export const initializeUpload = async (event) => {
    // Step 2 で実装予定: Presigned URL発行
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'InitializeUploadFunction placeholder' })
    };
};

export const registerEntry = async (event) => {
    // Step 2 で実装予定: DynamoDBへデータ登録とTTL設定
    return {
        statusCode: 201,
        body: JSON.stringify({ message: 'RegisterEntryFunction placeholder' })
    };
};
