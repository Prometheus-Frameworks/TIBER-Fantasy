# Rankings Backend System
**Simple, Transparent Fantasy Football Rankings Infrastructure**

## Overview
This backend system provides a straightforward infrastructure for storing and managing fantasy football rankings for the "On The Clock" website. It supports both **Redraft** and **Dynasty** formats, with Dynasty rankings split into **Rebuilder** and **Contender** consensus categories.

## Core Features
- **Individual Rankings Storage**: Users can submit personal rankings
- **Community Consensus**: Automatically calculated using simple averages
- **Real-time Updates**: Consensus recalculated immediately after submissions
- **Dynasty Format Support**: Separate consensus for rebuilder vs contender strategies
- **Transparent Algorithm**: Simple mathematical averages with no complex weighting

## System Architecture

### Database Schema
The system uses PostgreSQL with four core tables:

1. **`users`** - Basic user information
2. **`players`** - Master list of fantasy football players
3. **`individual_rankings`** - Personal rankings submitted by users
4. **`consensus_rankings`** - Calculated community consensus
5. **`ranking_submissions`** - Audit trail of all submissions

### API Endpoints

#### Submit Rankings
```
POST /api/rankings/submit
```
**Purpose**: Submit personal rankings for a user

**Request Body**:
```json
{
  "userId": 123,
  "format": "redraft" | "dynasty",
  "dynastyType": "rebuilder" | "contender",
  "rankings": [
    {
      "playerId": 456,
      "rankPosition": 1,
      "notes": "Top QB this season"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Rankings submitted successfully",
  "data": {
    "rankingsSubmitted": 50,
    "message": "Consensus will be calculated dynamically on next query"
  }
}
```

#### Get Consensus Rankings
```
GET /api/rankings/consensus?format=redraft&limit=200
```
**Purpose**: Retrieve community consensus rankings

**Parameters**:
- `format`: "redraft" | "dynasty" (required)
- `dynastyType`: "rebuilder" | "contender" (required for dynasty)
- `limit`: Number of results (default: 200)
- `offset`: Pagination offset (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "rankings": [
      {
        "playerId": 123,
        "playerName": "Josh Allen",
        "position": "QB",
        "team": "BUF",
        "averageRank": 1.25,
        "rankCount": 12,
        "consensusRank": 1,
        "format": "redraft"
      }
    ],
    "meta": {
      "format": "redraft",
      "totalResults": 50,
      "limit": 200,
      "offset": 0
    }
  }
}
```

#### Get Individual Rankings
```
GET /api/rankings/individual/:userId?format=redraft
```
**Purpose**: Retrieve personal rankings for a specific user

**Parameters**:
- `userId`: User ID (in URL path)
- `format`: "redraft" | "dynasty" (required)
- `dynastyType`: "rebuilder" | "contender" (required for dynasty)

#### Get Ranking Statistics
```
GET /api/rankings/stats?format=redraft
```
**Purpose**: Get participation statistics and metadata

**Response**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 25,
    "totalPlayers": 150,
    "lastSubmission": "2025-01-18T19:00:00Z",
    "format": "redraft",
    "consensusCalculation": "real-time"
  }
}
```

## Consensus Calculation Logic

### Simple Average Algorithm
The consensus system uses transparent mathematical averages:

1. **Collect Individual Rankings**: Gather all personal rankings for a format/dynasty type
2. **Calculate Averages**: For each player, sum all individual ranks and divide by count
3. **Sort by Average**: Order players by their average rank (lowest to highest)
4. **Assign Consensus Positions**: Assign sequential consensus ranks (1, 2, 3, ...)

### Example Calculation
```
Player A receives ranks: [1, 2, 3, 1, 2]
Average: (1 + 2 + 3 + 1 + 2) / 5 = 1.8
Consensus Rank: 1st (if lowest average)

Player B receives ranks: [5, 4, 6, 3, 5]
Average: (5 + 4 + 6 + 3 + 5) / 5 = 4.6
Consensus Rank: 15th (based on sort order)
```

## Dynasty Format Handling

### Format Types
- **Redraft**: Standard season-long fantasy format
- **Dynasty**: Multi-year keeper format with two consensus types:
  - **Rebuilder**: Focus on young players and future potential
  - **Contender**: Focus on immediate production and championship push

### Separate Consensus Calculation
Each dynasty type maintains its own consensus:
- Rebuilder consensus prioritizes different players than contender consensus
- Users can submit rankings for both dynasty types
- Consensus calculated independently for each type

## Data Validation

### Input Validation
- **User ID**: Must be valid integer
- **Format**: Must be "redraft" or "dynasty"
- **Dynasty Type**: Required for dynasty format, must be "rebuilder" or "contender"
- **Rankings**: Must be non-empty array with valid player IDs and positions

### Data Integrity Checks
- **Sequential Ranks**: Consensus ranks must be 1, 2, 3... with no gaps
- **No Duplicates**: Each consensus rank appears exactly once
- **Mathematical Accuracy**: Spot-check average calculations
- **Referential Integrity**: All player IDs must exist in players table

## Performance Considerations

### Database Optimization
- **Indexes**: Strategic indexes on common query patterns
- **Batch Operations**: Efficient bulk inserts and updates
- **Transaction Safety**: Atomic operations for data consistency

### Caching Strategy
- **Pre-calculated Consensus**: Avoid real-time calculations
- **Efficient Queries**: Minimal database round-trips
- **Pagination Support**: Handle large result sets

## Error Handling

### API Response Format
All endpoints return consistent response structure:
```json
{
  "success": true/false,
  "data": { ... },
  "error": "Error message if applicable"
}
```

### Common Error Codes
- **400 Bad Request**: Invalid input parameters
- **404 Not Found**: User or player not found
- **500 Internal Server Error**: Database or system error

## Monitoring and Transparency

### Audit Trail
- **Submission Log**: Complete history of all ranking submissions
- **Timestamp Tracking**: When consensus was last updated
- **User Activity**: Track participation across formats

### Statistics Endpoints
- **Participation Metrics**: Number of users, players, submissions
- **Consensus Health**: Validation results and integrity checks
- **Performance Metrics**: Calculation times and system health

## Setup Instructions

### Database Setup
1. Create PostgreSQL database
2. Run the schema creation script: `database/rankings_schema.sql`
3. Insert sample data or connect to player database

### API Integration
1. Import `rankingsApi.ts` into your Express app
2. Call `registerRankingRoutes(app)` to add endpoints
3. Ensure database connection is configured

### Testing
1. Use the sample data in the schema file
2. Test all endpoints with various format combinations
3. Validate consensus calculations with known datasets

## Future Enhancements

### Potential Improvements
- **Weighted Averages**: Allow expert user rankings to have more influence
- **Confidence Intervals**: Show uncertainty in consensus rankings
- **Historical Tracking**: Track how consensus changes over time
- **API Rate Limiting**: Prevent abuse with request throttling

### Integration Possibilities
- **External Data**: Connect to player statistics APIs
- **User Authentication**: Integrate with existing user systems
- **Real-time Updates**: WebSocket support for live consensus changes
- **Mobile API**: Optimized endpoints for mobile applications

## Technical Notes

### Dependencies
- **Express.js**: Web framework for API endpoints
- **PostgreSQL**: Relational database for data storage
- **Drizzle ORM**: Type-safe database operations
- **TypeScript**: Type safety and better development experience

### Code Organization
- **`database/rankings_schema.sql`**: Complete database schema
- **`server/rankingsApi.ts`**: API endpoint implementations
- **`server/consensusService.ts`**: Consensus calculation logic
- **`docs/RANKINGS_BACKEND_README.md`**: This documentation file

### Design Principles
1. **Simplicity**: Keep algorithms and data structures simple
2. **Transparency**: All calculations should be easily understood
3. **Reliability**: Use transactions and validation for data integrity
4. **Scalability**: Design for growth in users and data volume
5. **Maintainability**: Clear code structure and comprehensive documentation

---

*This backend system provides a solid foundation for fantasy football rankings with room for future enhancements while maintaining simplicity and transparency.*