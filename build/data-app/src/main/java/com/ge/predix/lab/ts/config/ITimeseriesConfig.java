package com.ge.predix.lab.ts.config;

import com.ge.predix.solsvc.websocket.config.IWebSocketConfig;

/**
 * 
 * @author 212438846
 */
public interface ITimeseriesConfig extends IWebSocketConfig {


	/**
	 * @return -
	 */
	public abstract String getQueryUrl();

    /**
     * The Predix-Zone-Id HTTP Header value when the websocket endpoint requires it.  This is usually the instanceId of the service
     * 
     * @return -
     */
    public abstract String getZoneId();
    
    /**
     * @param string -
     */
    public abstract void setZoneId(String string);


    /**
     * @return -
     */
    public abstract String getZoneIdHeader();


}