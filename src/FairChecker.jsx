import { useState } from 'react';
import { Input, Button } from 'reactstrap';
import './fairChecker.css';

const FAIR_CHECKER_URL = `https://fair-checker.france-bioinformatique.fr`;

const fetchORKGResourceData = async resourceId => {
    const orkgResourceData = {};

    const ORKG_URI = `https://orkg.org/resource/${resourceId}`;
    let DOI_URI = '';
    let STD_URI = '';

    const ORKG_API_URL = `https://orkg.org/api/statements/${resourceId}/bundle/?maxLevel=2`;

    const response = await fetch(ORKG_API_URL);
    const data = await response.json();

    let doiFound = false;
    let stdUrlFound = false;

    if (data.statements.length > 0) {
        data.statements.forEach(obj => {
            if (!(doiFound && stdUrlFound)) {
                // Find DOI
                if (!doiFound) {
                    if (obj?.predicate?.id) {
                        if (obj.predicate.id === 'P26') {
                            if (obj?.object?.label) {
                                DOI_URI = obj.object.label;
                                doiFound = true;
                            }
                        }
                    }
                }
                // Find Standard URL
                if (!stdUrlFound) {
                    if (obj?.predicate?.id) {
                        if (obj.predicate.id === 'url') {
                            if (obj?.object?.label) {
                                STD_URI = obj.object.label;
                                stdUrlFound = true;
                            }
                        }
                    }
                }
            }
        });

        // Appends URI attributes only if API request valid
        orkgResourceData.orkgUri = ORKG_URI;
        if (DOI_URI !== '') {
            orkgResourceData.doiUri = DOI_URI;
        }
        if (STD_URI !== '') {
            orkgResourceData.stdUri = STD_URI;
        }
    }

    return orkgResourceData;
};


async function evaluateAllFairMetrics(uri) {
    const API_URL = `${FAIR_CHECKER_URL}/api/check/metrics_all?url=${uri}`;
    
    const response = await fetch(API_URL);
    const jsonData = await response.json();
    return jsonData;
};

function FairCheckerTable({jsonData}) {
    if (!Array.isArray(jsonData)) {
        return (
            <div className='failure'>
                FAIR-Checker API Fetch Failed.
            </div>
        );
    }

    const data = Array.from(jsonData);

    const assessed_uri = jsonData[0]?.target_uri;

    const evalScore = data.reduce((prev, curr) => {
        const currScore = parseInt(curr.score);
        const success = (currScore > 0);

        const outputEvalScore = (success) ? (prev + currScore) : prev;

        return outputEvalScore;
    }, 0);

    const maxScore = data.reduce((prev) => {
        const outputMaxScore = prev + 2;
        return outputMaxScore;
    }, 0);

    return (
        <div>
            <div className='subHeader'>
                <div>
                    <span>FAIRness: </span>
                    <span className="success">
                        <b>{`${Math.round(100*((evalScore/maxScore)*100))/100}%`}</b>
                    </span>
                </div>
                <div>
                    <span>Evaluation Score: </span>
                    <span className="success">
                        <b>{`${evalScore}/${maxScore}`}</b>
                    </span>
                </div>
                <div>
                    <span>Assessed URI: </span>
                    <span className="success">
                        <b>{`${assessed_uri}`}</b>
                    </span>
                </div>
            </div>
            <div className='margin-top-basic'>
                <table>
                    <thead>
                        <tr className="grid-container">
                            <th>Metric</th>
                            <th>Description</th>
                            <th>Score</th>
                            <th>Comments</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, index) => {
                            let metric = item.metric;

                            let score = parseInt(item.score);
                            let success = (score > 0);

                            let recommendation = item.recommendation;

                            let description = '';
                            let comments = '';
                            
                            let comment = item.comment ?? '';
                            if (comment) {
                                let commentParts = Array.from(comment.split('\n'));
                                
                                let firstComment = commentParts[0];
                                let lastComment = commentParts.slice(-2)[0];
                                
                                let firstOmit = "INFO - Evaluating metrics ";
                                let lastOmit = "INFO - ";
                                if (firstComment.startsWith(firstOmit)) {
                                    description = firstComment.replace(firstOmit, '');
                                }
                                if (lastComment.startsWith(lastOmit)) {
                                    comments = (success) ? (lastComment.replace(lastOmit, '')) : recommendation;
                                }
                            }

                            return (
                                <tr key={`fairchecker_metric_${index}`} className="grid-container">
                                    <td className={(success) ? 'success' : 'failure'}>{metric}</td>
                                    <td className={(success) ? 'success' : 'failure'}>{description}</td>
                                    <td className={(success) ? 'success' : 'failure'}>{score}</td>
                                    <td className={(success) ? 'success' : 'failure'}>
                                        <div dangerouslySetInnerHTML={{ __html: `${comments}` }} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const parseResourceIdFromUrl = (url) => {
    let resourceId = '';

    const validUriMatch = url.match(/^(https|http):\/\/orkg.org\/(resource|paper|contribution|comparison)\/([R]\w+)$/);
    if (validUriMatch) {
        const resourceIdMatches = url.match(/(R[A-Z0-9]+)$/);

        if (resourceIdMatches.length > 0) {
            resourceId = resourceIdMatches[0];
        }
    }

    return resourceId;
}

const loadORKGData = (url, setURIData) => {
    let loadedURIData = {}

    const resourceId = parseResourceIdFromUrl(url);

    if (resourceId != '') {
        fetchORKGResourceData(resourceId).then(orkgResourceData => {
            if (orkgResourceData?.orkgUri) {
                loadedURIData.orkgUri = `${orkgResourceData.orkgUri}`;
                if (orkgResourceData?.doiUri) {
                    loadedURIData.doiUri = orkgResourceData.doiUri;
                }
                if (orkgResourceData?.stdUri) {
                    loadedURIData.stdUri = orkgResourceData.stdUri;
                }
    
                setURIData(loadedURIData);
                console.log(`Success - ORKG API Fetch [ResourceId: ${resourceId}].`);
                console.log(`loadedURIData: ${JSON.stringify(loadedURIData)}.`)
            } else {
                setURIData({});
                console.log('Error [loadORKGData] - ORKG API Fetch Failed - Empty Statements returned - Invalid URI.');
            }
        }).then(() => {
        })
        .catch(() => {
            console.log('Exception [loadORKGData] - ORKG API Fetch Failed.');
        });
    } else {
        setURIData({});
        console.log('Error [loadORKGData] - Parsing resource.');
    }
}

function SearchBar({ searchText, setSearchText, setURIData}) {
    return (
        <div className='widget-container'>
                <Input 
                    type="text" 
                    placeholder='Enter valid ORKG resource URI here...' 
                    text={searchText}
                    className="search-input-field"
                    onChange={e => {
                        setSearchText(e.target.value);
                    }}
                    />
                <Button 
                    className='btn btn-primary load-url-button'
                    style={{
                        color: 'white',
                        backgroundColor: '#e86161',
                        borderColor: '#e86161',
                        borderRadius: 5,
                    }}
                    onClick={e => {
                        const enteredURI = searchText;
                        loadORKGData(enteredURI, setURIData);
                    }}>Load URI</Button>
        </div>
    );
}

const FairButton = ({uri, setFairnessData, setFairAPILoading}) => {
    return (
        <div>
            <Button
                style={{
                    color: 'white',
                    backgroundColor: '#e86161',
                    borderColor: '#e86161',
                    borderRadius: 5,
                }}
                onClick={() => {
                    setFairnessData(null);
                    setFairAPILoading(true);
                    
                    evaluateAllFairMetrics(uri)
                    .then((response) => {
                        setFairnessData(response);
                        console.log(`Success [evaluateAllFairMetrics]: FAIR-Checker Evaluation Success - URI: ${uri}`);
                        console.log(`FAIR-Checker Response: ${JSON.stringify(response)}`);
                        setFairAPILoading(false);
                    })
                    .then(() => {
                        setFairAPILoading(false);
                    })
                    .catch(() => {
                        setFairnessData(null);
                        console.log(`Exception [evaluateAllFairMetrics]: FAIR-Checker Evaluation Failed - URI: ${uri}`);
                        setFairAPILoading(false);
                    });

                    setFairAPILoading(false);
                }}
            >FAIR</Button>
        </div>
    );
}

const URIDisplayWidget = ({uriData, setFairnessData, setFairAPILoading}) => {
    return (
        <div className='widget-container'>
            {uriData?.orkgUri && (
                <div className='block-display full-width'>
                    <div className='block-display text-align-left success'>
                        Is a valid ORKG Resource URI
                    </div>
                    <div className='block-display text-align-left margin-top-basic'>
                            <div className='flex-display vertical-margin-basic'>
                                <div className='margin-right-basic'>
                                    <FairButton uri={uriData.orkgUri} setFairnessData={setFairnessData} setFairAPILoading={setFairAPILoading} />
                                </div>
                                <div>ORKG URI: <b>{uriData.orkgUri}</b></div>
                            </div>
                            {uriData?.doiUri && (
                                <div className='flex-display vertical-margin-basic'>
                                    <div className='margin-right-basic'>
                                        <FairButton uri={uriData.doiUri} setFairnessData={setFairnessData} setFairAPILoading={setFairAPILoading} />
                                    </div>
                                    <div>DOI: <b>{`${uriData.doiUri}`}</b></div>
                                </div>
                            )}
                            {uriData?.stdUri && (
                                <div className='flex-display vertical-margin-basic'>
                                    <div className='margin-right-basic'>
                                        <FairButton uri={uriData.stdUri} setFairnessData={setFairnessData} setFairAPILoading={setFairAPILoading} />
                                    </div>
                                    <div>Standard URI: <b>{`${uriData.stdUri}`}</b></div>
                                </div>
                            )}
                    </div>
                </div>
            )}
            {!uriData?.orkgUri && (
                <div className='block-display full-width'>
                    <div className = 'block-display text-align-left failure'>
                        Not a valid ORKG Resource URI
                    </div>
                </div>
            )}
        </div>
    );
}

function FairCheckerTool() {
    const [searchText, setSearchText] = useState('');
    const [uriData, setURIData] = useState(null);
    const [fairnessData, setFairnessData] = useState(null);
    const [fairAPILoading, setFairAPILoading] = useState(false);

    return (
        <div className='window-container'>
            <div className='inner-container heading'>
                <b>ORKG FAIRness Assessment Tool (powered by <a href='https://fair-checker.france-bioinformatique.fr/'>FAIR-Checker</a>)</b>
            </div>
            <div className='inner-container'>
                <SearchBar searchText={searchText} setSearchText={setSearchText} setURIData={setURIData} />
            </div>
            <div className='inner-container'>
                {uriData && (
                    <div>
                        <URIDisplayWidget uriData={uriData} setFairnessData={setFairnessData} setFairAPILoading={setFairAPILoading} />
                    </div>
                )}
            </div>
            <div className='inner-container'>
                {!fairAPILoading && fairnessData && (
                    <div>
                        {fairnessData && (
                            <div>
                                <FairCheckerTable jsonData={fairnessData} />
                            </div>
                        )}
                    </div>
                )}
                {fairAPILoading && (
                    <div className='success'>
                        Fetching FAIR-Checker API Data...
                    </div>
                )}
            </div>
        </div>
    );
}

export default FairCheckerTool;
