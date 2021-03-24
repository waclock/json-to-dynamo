let response;
const fileToImport = require("./fileToImport.json");
const AWS = require("aws-sdk");
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;
const PRIMARY_KEY = process.env.PRIMARY_KEY;
const SEARCHABLE_FIELDS = process.env.SEARCHABLE_FIELDS.split(",");
/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
exports.lambdaHandler = async (event, context) => {
  const chunk = (array, size) =>
    array.reduce((acc, _, i) => {
      if (i % size === 0) {
        acc.push(array.slice(i, i + size));
      }
      return acc;
    }, []);

  const schema = {
    searchableFields: SEARCHABLE_FIELDS,
    primaryKey: PRIMARY_KEY,
    tableName: TABLE_NAME,
  };

  const searchableItem = (item, primaryKey, searchableFields) => {
    searchableFields.map((field) => {
      item[`${field}Search`] = item[field].toLowerCase();
    });
    item["id"] = item[primaryKey];
    return item;
  };

  let promises = [];
  try {
    const chunked = chunk(fileToImport, 25);
    for (const chunk of chunked) {
      const chunkedItems = [];
      for (const chunkedItem of chunk) {
        const item = {
          PutRequest: {
            Item: searchableItem(
              chunkedItem,
              schema.primaryKey,
              schema.searchableFields
            ),
          },
        };
        chunkedItems.push(item);
      }
      const params = { RequestItems: {} };
      params["RequestItems"][TABLE_NAME] = chunkedItems;
      promises.push(dynamoDb.batchWrite(params).promise());
    }
    await Promise.all(promises);
    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: "File Imported",
      }),
    };
  } catch (err) {
    console.log(err);
    throw err;
  }

  return response;
};
