import React, { Component } from 'react'
import Web3 from 'web3'
import * as moment from 'moment'
import './App.css'
import config from './config.json'

const BlockSummary = (({ block, style, isSyncing }) => {
  return (
    <div style={{...style, float: 'left', paddingLeft: '20px', textAlign: 'left'}}>
      <span>{'Block: '}</span>
      <span className={'blockDetails'}>{`${block.number} | ${
        !isSyncing ? (`${
          block.timestamp ?
            moment.unix(block.timestamp).format('MM/DD/YY h:mm:ss a') :
            '...'
        }\n`) : 'syncing chain...'
      }`}</span>
    </div>
  )
})

const TicketsList = (({ approvedTickets, totalNumberOfTickets }) => {
  let allTickets = [...Array(totalNumberOfTickets)].map(
    (_, i) => approvedTickets.includes(i + 1) ? i + 1 : false
  )

  return (
    <div>
      {allTickets.length > 0 ?
        <ul>
          {
            allTickets.map((ticket, index) => {
              return (
                <li key={index}>
                  <div style={{whiteSpace: 'pre-line', paddingBottom: '8px'}}>
                    <span>
                      {`Ticket ${index + 1} - `}
                    </span>
                    {((ticket !== false) ?
                      <span style={{color: '#0f0'}}>
                        {'approved!'}
                      </span> :
                      <span style={{color: 'dodgerBlue'}}>
                        {'waiting for approval...'}
                      </span>
                    )}
                  </div>
                </li>
              )
            })
          }
        </ul> :
        <div style={{paddingLeft: '20px', paddingTop: '16px'}}>
          {'Waiting for access requests...'}
        </div>
      }
    </div>
  )
})

export default class App extends Component {
  constructor(props) {
    super(props)

    const cyberClubhouseAddress = config.cyberClubhouseAddress
    const contractDeployedBlock = config.contractDeployedBlock
    const provider = process.env.REACT_APP_WEB3_PROVIDER ?
      process.env.REACT_APP_WEB3_PROVIDER :
      config.infuraWebsocket  // NOTE: this isn't production-ready

    // set up a dummy web3 object that will throw unless is is replaced.
    this.web3 = {
      version: null,
      eth: {
        isSyncing: (() => {
          return Promise.reject('Error: no Web3 provider found.')
        }),
        Contract: ((..._) => {
          return false && _
        })
      }
    }

    // set up the actual web3 object, preferring one that already exists
    if (typeof window.web3 !== 'undefined' &&
        typeof window.web3.currentProvider !== 'undefined') {
      this.web3 = new Web3(window.web3.currentProvider)
    } else if (typeof provider === 'string') {
      console.log('No Web3 provider detected, trying `' + provider + '`...')
      if (provider.startsWith('ws')) {
        this.web3 = new Web3(new Web3.providers.WebsocketProvider(provider))
      } else if (provider.startsWith('http')) {
        this.web3 = new Web3(new Web3.providers.HttpProvider(provider))
      }
    }

    const theCyberClubhouseABI = [
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            name: 'passphrase',
            type: 'string'
          }
        ],
        name: 'GrantAdmission',
        type: 'event'
      },
      {
        constant: false,
        inputs: [
          {
            name: 'passphrase',
            type: 'string'
          }
        ],
        name: 'theCyberMessage',
        outputs: [],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function'
      }
    ]

    const theCyberClubhouseContract = new this.web3.eth.Contract(
      theCyberClubhouseABI,
      cyberClubhouseAddress,
      {
        gas: 1
      }
    )

    // get event id and number of tickets
    let eventId = localStorage.getItem('eventId')
    let accessRequestCount = localStorage.getItem('accessRequestCount')

    if (eventId === null) {
      localStorage.setItem('eventId', Math.floor((1 + Math.random()) * 0x10000000).toString(16))
      localStorage.setItem('accessRequestCount', '0')
      eventId = localStorage.getItem('eventId')
      accessRequestCount = 0
    }

    if (accessRequestCount === null) {
      localStorage.setItem('accessRequestCount', '0')
      accessRequestCount = 0
    } else {
      accessRequestCount = parseInt(accessRequestCount, 10)
    }

    console.log(eventId, accessRequestCount)

    // bind functions and initialize state
    this.updateToLatestBlock = this.updateToLatestBlock.bind(this)
    this.setBlockDetails = this.setBlockDetails.bind(this)
    this.setEvents = this.setEvents.bind(this)
    this.requestAccess = this.requestAccess.bind(this)
    this.repopulateTickets = this.repopulateTickets.bind(this)
    this.newEvent = this.newEvent.bind(this)
    this.state = {
      hasWeb3: false,
      loading: true,
      isSyncing: null,
      syncObject: false,
      block: {number: null},
      theCyberClubhouseContract: theCyberClubhouseContract,
      cyberClubhouseAddress: cyberClubhouseAddress,
      contractDeployedBlock: contractDeployedBlock,
      eventId: eventId,
      eventsSet: false,
      accessRequestMap: {},
      accessRequestCount: accessRequestCount,
      accessRequestMessage: '\nWaiting for access requests...\n\n',
      approvedTickets: [],
      detectedPassphrases: new Set()
    }
  }

  async componentDidMount() {
    // check if the blockchain is syncing & ensure that web3 is working
    this.web3.eth.isSyncing()
      .then(syncObject => {
        // get latest block / wallet information & set up polling for updates
        this.updateToLatestBlock()
        setInterval(this.updateToLatestBlock, 500)

        // regenerate existing tickets for the event
        if (this.state.accessRequestCount > 0) {
          [...Array(this.state.accessRequestCount)].map(
            this.repopulateTickets
          )
        }

        this.setState({
          hasWeb3: true,
          isSyncing: (syncObject ? true : false),
          syncObject: syncObject
        })

        return Promise.resolve(true)
      })
      .catch(error => {
        console.error(error)

        this.setState({
          hasWeb3: false,
          loading: false
        })

        return Promise.reject(false)
      })
  }

  setEvents() {
    if (!this.state.eventsSet) {
      console.log('getting event histories...')
      this.setState({
        eventsSet: true
      })

      // NOTE: we may not be interested in collecting ALL of the event histories
      // going back to the block where the contract was deployed, especially if
      // it slows down load times significantly. Consider using something like
      // max(`contractDeployedBlock`, (`latest` - <desiredHistoryLength>)).

      // add a listener for new `GrantAdmission` events
      this.state.theCyberClubhouseContract.events.GrantAdmission(
        {},
        {fromBlock: this.state.contractDeployedBlock, toBlock: 'latest'}
      ).on('data', event => {
        let detectedPassphrases = this.state.detectedPassphrases
        detectedPassphrases.add(event.returnValues.passphrase)
        this.setState({
          detectedPassphrases: detectedPassphrases
        })

        if (event.returnValues.passphrase in this.state.accessRequestMap) {
          const ticket = this.state.accessRequestMap[event.returnValues.passphrase]
          let approvedTickets = this.state.approvedTickets
          if (approvedTickets.includes(ticket) === false) {
            approvedTickets.push(ticket)
          }
          this.setState({
            approvedTickets: approvedTickets.sort()
          }, () => {
            console.log(`GRANTED ACCESS TO TICKET ${ticket}`)
          })
        }
      }).on('error', error => {
        console.error(error)
      })
    }
    return Promise.resolve(true)
  }

  updateToLatestBlock() {
    return this.web3.eth.getBlockNumber()
      .then(blockNumber => {
        if (blockNumber && (blockNumber !== this.state.block.number)) {
          if (!this.state.block.hash) {
            this.setState({
              block: {number: blockNumber}
            })
          }
          return Promise.all([
            this.setBlockDetails(blockNumber)
          ]).then(() => {
            this.setState({
              loading: false
            })
          }).then(() => {
            return (
              this.setEvents()
            )
          })
        }

        return Promise.resolve(false)
      }).catch(error => {
        console.error(error)
      })
  }

  setBlockDetails(blockNumber) {
    return this.web3.eth.getBlock(blockNumber)
      .then(block => {
        if (block) {
          this.setState({
            block: block
          }, () => {
            let details = document.getElementsByClassName('blockDetails')[0]
            if (typeof details !== 'undefined') {
              if (this.state.flashClear && details.classList.contains('flash')) {
                clearTimeout(this.state.flashClear)
                details.classList.remove('flash')
                setTimeout(() => {
                  details.classList.add('flash')
                }, 10)
              } else {
                details.classList.add('flash')
              }
              const flashClear = setTimeout(() => {
                details.classList.remove('flash')
              }, 5100)
              this.setState({
                flashClear: flashClear
              })
            }
          })
        }
      }).catch(error => {
        console.error(error)
      })
  }

  requestAccess() {
    let accessRequestMap = this.state.accessRequestMap
    const ticket = Object.keys(accessRequestMap).length + 1
    const challenge = `Admit ticket ${ticket} to event ${this.state.eventId}.`
    accessRequestMap[challenge] = ticket
    localStorage.setItem('accessRequestCount', Object.keys(accessRequestMap).length)

    let approvedTickets = this.state.approvedTickets
    if (
      this.state.detectedPassphrases.has(challenge) &&
      approvedTickets.includes(ticket) === false
    ) {
      approvedTickets.push(ticket)
      this.setState({
        approvedTickets: approvedTickets.sort()
      }, () => {
        console.log(`GRANTED ACCESS TO TICKET ${ticket}`)
      })
    }
    const response = `Ticket: #${
      ticket}\nChallenge:\n\u00a0\`${
      challenge}\``
    this.setState({
      accessRequestMap: accessRequestMap,
      accessRequestMessage: response
    }, () => {
      console.log(response)
    })
  }

  repopulateTickets() {
    let accessRequestMap = this.state.accessRequestMap
    const ticket = Object.keys(accessRequestMap).length + 1
    const challenge = `Admit ticket ${ticket} to event ${this.state.eventId}.`
    accessRequestMap[challenge] = ticket
    localStorage.setItem('accessRequestCount', Object.keys(accessRequestMap).length)

    let approvedTickets = this.state.approvedTickets
    if (
      this.state.detectedPassphrases.has(challenge) &&
      approvedTickets.includes(ticket) === false
    ) {
      approvedTickets.push(ticket)
      this.setState({
        approvedTickets: approvedTickets.sort()
      }, () => {
        console.log(`FOUND EXISTING GRANTED TICKET ${ticket}`)
      })
    }
    this.setState({
      accessRequestMap: accessRequestMap
    })
  }

  newEvent() {
    const c = window.confirm(
      `Warning: Starting a new event will cause all off-chain data from event ${
        this.state.eventId} to be wiped, and the ability to validate any ${
        ''}tickets issued so far will be lost. Do you still wish to continue?`
    )
    if (c) {
      const eventId = Math.floor((1 + Math.random()) * 0x10000000).toString(16)
      localStorage.setItem('eventId', eventId)
      localStorage.setItem('accessRequestCount', '0')
      this.setState({
        eventId: eventId,
        approvedTickets: [],
        accessRequestMap: {},
        accessRequestMessage: '\nWaiting for access requests...\n\n'
      })
    }
  }

  render() {
    if (this.state.loading || !this.state.block) {
      return (
        <div className='App'>
          <div>
            <br />
            <div>
              {'Loading...'}
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className='App'>
        {
          (this.state.hasWeb3 ?
            <div>
              <header className='App-header'>
                <h1 className='App-title'>
                  <span>{'theCyber'}</span><span style={{color: 'gold'}}>{'Clubhouse'}</span>
                </h1>
              </header>
              <div>
                <BlockSummary
                  block={this.state.block}
                  style={this.style}
                  isSyncing={this.state.isSyncing}
                />
                <br />
                <div style={{...this.style, float: 'left', paddingLeft: '20px'}}>
                  <div style={{...this.style, float: 'left'}}>
                    {'Contract located at\u00a0'}
                  </div>
                  <div style={{...this.style, float: 'left', color: 'gold'}}>
                    {this.state.cyberClubhouseAddress}
                  </div>
                  <div style={{...this.style, clear: 'both', padding: '8x'}} />
                  <div style={{...this.style, float: 'left'}}>
                    {'Event ID:\u00a0'}
                  </div>
                  <div style={{...this.style, float: 'left', color: 'red'}}>
                    {this.state.eventId}
                  </div>
                  <div
                    style={{
                      ...this.style,
                      paddingLeft: '20px',
                      float: 'left',
                      fontSize: '.7em'
                    }}
                  >
                    <button
                      onClick={this.newEvent}
                    >
                      {'new event'}
                    </button>
                  </div>
                </div>
                <br />
              </div>
              <div style={{...this.style, clear: 'both', padding: '8x'}} />
              <div
                style={{
                  ...this.style,
                  paddingLeft: '20px',
                  textAlign: 'left',
                  whiteSpace: 'pre-line',
                  paddingTop: '20px',
                  fontSize: '1.1em'
                }}
              >
                {this.state.accessRequestMessage}
              </div>
              <div style={{...this.style, clear: 'both', paddingTop: '20px'}} />
              <button
                style={{...this.style, fontSize: '1.5em'}}
                onClick={this.requestAccess}
              >
                {'request access'}
              </button>
              <div
                style={{
                  ...this.style,
                  textAlign: 'left',
                  paddingTop: '30px',
                  paddingLeft: '20px'
                }}
              >
                <div>
                  {'Status of access requests:'}
                </div>
                <TicketsList
                  approvedTickets={this.state.approvedTickets}
                  totalNumberOfTickets={Object.keys(this.state.accessRequestMap).length}
                />
              </div>
            </div> :
            <div>
              <header className='App-header' style={{...this.style, color: 'white'}}>
                <h1 className='App-title'>
                  Cannot find a Web3 provider! (Try using&nbsp;
                  <a
                    style={{...this.style, color: 'cyan'}}
                    href='https://metamask.io'
                  >
                    MetaMask
                  </a> on desktop or&nbsp;
                  <a
                    style={{...this.style, color: 'cyan'}}
                    href='https://www.cipherbrowser.com'
                  >
                    Cipher Browser
                  </a>
                  &nbsp;on mobile.)
                </h1>
              </header>
            </div>
          )
        }
      </div>
    )
  }
}
