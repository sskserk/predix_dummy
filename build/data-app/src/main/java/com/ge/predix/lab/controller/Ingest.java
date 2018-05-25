package com.ge.predix.lab.controller;

import com.ge.predix.entity.timeseries.datapoints.ingestionrequest.DatapointsIngestion;
import com.ge.predix.lab.ts.client.TimeseriesClient;
import com.ge.predix.lab.ts.client.TimeseriesClientImpl;
import com.ge.predix.solsvc.websocket.client.WebSocketClient;
import com.ge.predix.lab.domain.IngestResult;
import com.ge.predix.timeseries.client.ClientFactory;
import com.ge.predix.timeseries.client.TenantContext;
import com.ge.predix.timeseries.client.TenantContextFactory;
import com.ge.predix.timeseries.exceptions.PredixTimeSeriesException;
import com.ge.predix.timeseries.model.builder.IngestionRequestBuilder;
import com.ge.predix.timeseries.model.builder.IngestionTag;
import com.ge.predix.timeseries.model.datapoints.DataPoint;
import com.ge.predix.timeseries.model.datapoints.Quality;
import com.ge.predix.timeseries.model.response.IngestionResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Date;


@RestController
public class Ingest {
    private static final Logger logger = LoggerFactory.getLogger(Ingest.class);

    @Autowired
    private TimeseriesClientImpl timeSeriesClient;

    @RequestMapping("/ingest")
    public ResponseEntity<IngestResult> ingest() {
        logger.info("ingestion request");

        timeSeriesClient.getTimeseriesHeaders();
        //timeSeriesClient.getTimeseriesHeaders();


        HttpHeaders responseHeaders = new HttpHeaders();


        IngestResult ingResult = new IngestResult();
        ingResult.setMessage("OK");
        return new ResponseEntity<>(ingResult, responseHeaders, HttpStatus.FOUND);

    }

    private void ingestData() throws IOException, URISyntaxException, PredixTimeSeriesException {

        //todo: populate from env
        final String ingestionUrl = "wss://gateway-predix-data-services.run.aws-usw02-pr.ice.predix.io/v1/stream/messages";
        final String authToken = "";
        final String zoneIdHeaderName = "Predix-Zone-Id";
        final String zoneIdHeaderValue = "5098822d-12b3-4607-bb14-de0c3064f3a9";
        //TenantContextFactory.createIngestionTenantContextFromProvidedProperties()

        final TenantContext ingestTenant =
                TenantContextFactory
                        .createIngestionTenantContextFromProvidedProperties(ingestionUrl, authToken, zoneIdHeaderName, zoneIdHeaderValue);

        IngestionRequestBuilder ingestionBuilder = IngestionRequestBuilder.createIngestionRequest()
                .withMessageId(Long.toString(System.nanoTime()))
                .addIngestionTag(IngestionTag.Builder.createIngestionTag()
                        .withTagName("TagName")
                        .addDataPoints(
                                Arrays.asList(
                                        new DataPoint(new Date().getTime(), Math.random(), Quality.GOOD),
                                        new DataPoint(new Date().getTime(), "Bad Value", Quality.BAD),
                                        new DataPoint(new Date().getTime(), null, Quality.UNCERTAIN)
                                )
                        )
                        .addAttribute("AttributeKey", "AttributeValue")
                        .addAttribute("AttributeKey2", "AttributeValue2")
                        .build());

        String json = ingestionBuilder.build().get(0);
        IngestionResponse response = ClientFactory.ingestionClientForTenant(ingestTenant).ingest(json);
        String responseStr = response.getMessageId() + response.getStatusCode();
    }
//
//    private DatapointsIngestion getDataToIngest() {
//        DatapointsIngestion data = new DatapointsIngestion();
//        data.a
//    }
}
