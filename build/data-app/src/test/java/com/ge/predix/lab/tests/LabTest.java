package com.ge.predix.lab.tests;

import com.fasterxml.jackson.databind.JsonNode;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ge.predix.timeseries.client.ClientFactory;
import com.ge.predix.timeseries.client.TenantContext;
import com.ge.predix.timeseries.client.TenantContextFactory;

import com.ge.predix.timeseries.model.response.IngestionResponse;
import com.ge.predix.timeseries.model.response.QueryResponse;
import com.jayway.jsonpath.JsonPath;
import org.apache.commons.codec.binary.Base64;
import org.apache.commons.io.IOUtils;
import org.apache.http.HttpHeaders;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;


import java.util.concurrent.TimeUnit;

@RunWith(SpringJUnit4ClassRunner.class)
public class LabTest {

    private static final Logger logger = LoggerFactory.getLogger(LabTest.class);

    @Test
    public void ingestAndRequest() throws Exception {
       
        final String authToken = obtainToken();

        testIngest(authToken);

        testQuery(authToken);
    }

    private String obtainToken() throws Exception {
        CloseableHttpClient httpClient = HttpClients.createDefault();
        HttpPost httpPost = new HttpPost("https://d2492d70-9688-40c9-a8d8-7f0b8eb8424c.predix-uaa.run.aws-usw02-pr.ice.predix.io/oauth/token?grant_type=client_credentials");
        httpPost.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache");
        httpPost.setHeader(HttpHeaders.CONTENT_TYPE, "application/json");

        httpPost.setHeader(HttpHeaders.AUTHORIZATION, "Basic cHJlZGl4X2NsaWVudDpQcjNAMVgyMDE4");

        CloseableHttpResponse response = null;
        try {
            response = httpClient.execute(httpPost);

            String jsonString = IOUtils.toString(response.getEntity().getContent());
            String token = "";
            logger.info("response: {}", jsonString);

            ObjectMapper mapper = new ObjectMapper();
            JsonNode rootNode = mapper.readTree(jsonString);

            token = rootNode.get("access_token").asText();

            logger.info("access_token: {}", token);
            return token;
        } catch (Exception ex) {
            logger.error("{}", ex);
            throw ex;
        } finally {
            response.close();
        }


    }


    private void testIngest(String authToken) throws Exception {
        final String ingestionUrl = "wss://gateway-predix-data-services.run.aws-usw02-pr.ice.predix.io/v1/stream/messages";

        final String zoneIdHeaderName = "Predix-Zone-Id";
        final String zoneIdHeaderValue = "6f8f6c63-205e-420d-8c4a-d4d28d263ebe";

        final TenantContext ingestTenant =
                TenantContextFactory
                        .createIngestionTenantContextFromProvidedProperties(ingestionUrl,
                                authToken,
                                zoneIdHeaderName,
                                zoneIdHeaderValue);

        String ingestJson = IOUtils.toString(this.getClass().getResourceAsStream("/ts_ingest.json"));

        logger.info("length data: {}", ingestJson.length());

        long startTime = System.nanoTime();
        IngestionResponse response = ClientFactory.ingestionClientForTenant(ingestTenant).ingest(ingestJson);
        long duration = System.nanoTime() - startTime;
        logger.info("insert time: {}", TimeUnit.NANOSECONDS.toMillis(duration));
        String responseStr = response.getMessageId() + response.getStatusCode();

        logger.info("OK:" + responseStr);
    }

    private void testQuery(String authToken) throws Exception {
        final String queryUrl = "https://time-series-store-predix.run.aws-usw02-pr.ice.predix.io/v1/datapoints";
        final String zoneIdHeaderName = "Predix-Zone-Id";
        final String zoneIdHeaderValue = "6f8f6c63-205e-420d-8c4a-d4d28d263ebe";

        final TenantContext queryTenant =
                TenantContextFactory
                        .createQueryTenantContextFromProvidedProperties(queryUrl,
                                authToken,
                                zoneIdHeaderName,
                                zoneIdHeaderValue);

        String queryJson = IOUtils.toString(this.getClass().getResourceAsStream("/ts_query.json"));

        logger.info("query json: {}", queryJson);

        QueryResponse response = ClientFactory.queryClientForTenant(queryTenant).query(queryJson);
        response.getTags().forEach(tag -> {
            logger.info("TAG: {}", tag.getName());


            tag.getResults().forEach(value -> {
                logger.info(value.toString());
                value.getDataPoints().forEach(point -> logger.info("data point: {}", point.toString()));
            });
            //logger.info(tag.ge)
        });
        //    logger.info("RESPONSE: {}", response.);


    }
}
