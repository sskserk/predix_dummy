package com.ge.predix.lab.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletResponse;
import java.io.OutputStream;

@RestController
public class EnvView {
    private static final Logger logger = LoggerFactory.getLogger(Index.class);

    @RequestMapping(value="/env", method=RequestMethod.GET)
    public void envView(HttpServletResponse response) throws Exception {
        logger.info("Request for env data has been received");

        // Set the content type and attachment header.
        // response.addHeader("Content-disposition", "attachment;filename=myfilename.txt");

        response.setContentType("text/plain");

        OutputStream ous = response.getOutputStream();
        ous.write(System.getenv().toString().getBytes());

        response.flushBuffer();
    }
}