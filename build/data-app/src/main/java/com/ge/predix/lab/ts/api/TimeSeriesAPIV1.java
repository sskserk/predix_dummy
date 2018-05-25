package com.ge.predix.lab.ts.api;

/**
 * Constants defining the Time Series URLs
 * @author predix -
 */
@SuppressWarnings("nls")
public final class TimeSeriesAPIV1 {
    /**
     * The main url for Querying Time Series data
     */
    public static final String datapointsURI = "/v1/datapoints";
	/**
	 * The url for Querying Time Series for the last datapoint 
	 */
	public static final String latestdatapointsURI = "/v1/datapoints/latest";
	/**
	 * The url for getting a list of tags
	 */
	public static final String tagsURI = "/v1/tags";
	/**
	 * The url for doing aggregation queries (average over a sample interval) 
	 */
	public static final String aggregationsURI = "/v1/aggregations";

}
