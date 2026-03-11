export const listEntries = async (event) => {
    // Step 2 で実装予定: TTL考慮の一覧取得
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'ListEntriesFunction placeholder' })
    };
};

export const bulkDelete = async (event) => {
    // Step 2 で実装予定: DBとS3の一括削除
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'BulkDeleteFunction placeholder' })
    };
};
