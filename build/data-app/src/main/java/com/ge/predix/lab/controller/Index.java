package com.ge.predix.lab.controller;


import com.ge.predix.lab.domain.IndexPage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
public class Index  {
	private static final Logger logger = LoggerFactory.getLogger(Index.class);

    @RequestMapping("/index")
	public ResponseEntity<IndexPage> index() {
		logger.info("Request for Index page has been received");

		HttpHeaders responseHeaders = new HttpHeaders();

		IndexPage indexPage = new IndexPage();
		indexPage.setName("IndexPage");
		return new ResponseEntity<>(indexPage, responseHeaders, HttpStatus.FOUND);
	}
}
